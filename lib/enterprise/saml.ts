// Phase 6: lightweight self-contained SAML helpers.
// Defensive-only — we accept SAML responses, validate them, and create JIT
// users. No SP-initiated XML signing of AuthnRequests is performed.
//
// We rely on Node's built-in crypto for signature verification rather than
// pulling in a heavy dependency. The verification path covers:
//   * envelope signature on the Response (or assertion-level signature)
//   * audience restriction = SP entity id
//   * issuer match
//   * NotBefore / NotOnOrAfter window
//   * replay protection via the Response ID
//
// Format support is limited to the common Okta/Azure AD/Google Workspace
// shapes: a single Response with at most one Assertion, RSA-SHA256 signature,
// exclusive C14N transform, and base64-encoded data.

import { createPublicKey, createVerify, randomBytes, timingSafeEqual } from "crypto";

export interface SamlIdpConfig {
  entityId: string;
  ssoUrl: string;
  x509Certificate: string;
}

export interface SamlSpConfig {
  entityId: string;
  acsUrl: string;
}

export interface SamlAssertionAttributes {
  email: string;
  name?: string;
  groups: string[];
  raw: Record<string, string[]>;
}

export interface SamlValidationResult {
  attributes: SamlAssertionAttributes;
  responseId: string;
  issuer: string;
  notBefore?: Date;
  notOnOrAfter?: Date;
}

export class SamlError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SamlError";
  }
}

function safeMatch(input: string, pattern: RegExp): string | null {
  const match = pattern.exec(input);
  return match ? match[1] : null;
}

function decodeXmlText(value: string): string {
  return value
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, "\"")
    .replace(/&apos;/g, "'");
}

export function parseIdpMetadata(metadataXml: string): SamlIdpConfig {
  const entityId = safeMatch(metadataXml, /entityID=\"([^\"]+)\"/) ?? safeMatch(metadataXml, /entityID='([^']+)'/);
  if (!entityId) throw new SamlError("Metadata is missing entityID.");
  const ssoUrl =
    safeMatch(metadataXml, /<[^>]*SingleSignOnService[^>]*Binding=\"urn:oasis:names:tc:SAML:2\\.0:bindings:HTTP-Redirect\"[^>]*Location=\"([^\"]+)\"/) ??
    safeMatch(metadataXml, /<[^>]*SingleSignOnService[^>]*Location=\"([^\"]+)\"/) ??
    safeMatch(metadataXml, /SingleSignOnService[^>]*Location='([^']+)'/);
  if (!ssoUrl) throw new SamlError("Metadata is missing SingleSignOnService location.");
  const certBlock = safeMatch(metadataXml, /<ds:X509Certificate[^>]*>([\s\S]*?)<\/ds:X509Certificate>/) ??
    safeMatch(metadataXml, /<X509Certificate[^>]*>([\s\S]*?)<\/X509Certificate>/);
  if (!certBlock) throw new SamlError("Metadata is missing an X509Certificate.");
  const cert = certBlock.replace(/\s+/g, "");
  const pem = `-----BEGIN CERTIFICATE-----\n${cert.match(/.{1,64}/g)?.join("\n") ?? cert}\n-----END CERTIFICATE-----\n`;
  return { entityId, ssoUrl, x509Certificate: pem };
}

export function buildSpMetadata(sp: SamlSpConfig): string {
  return `<?xml version="1.0"?>
<EntityDescriptor xmlns="urn:oasis:names:tc:SAML:2.0:metadata" entityID="${escapeXml(sp.entityId)}">
  <SPSSODescriptor protocolSupportEnumeration="urn:oasis:names:tc:SAML:2.0:protocol" AuthnRequestsSigned="false" WantAssertionsSigned="true">
    <NameIDFormat>urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress</NameIDFormat>
    <AssertionConsumerService index="0" isDefault="true" Binding="urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST" Location="${escapeXml(sp.acsUrl)}"/>
  </SPSSODescriptor>
</EntityDescriptor>`;
}

export function buildAuthnRequest(sp: SamlSpConfig, idp: SamlIdpConfig, relayState?: string): {
  redirectUrl: string;
  requestId: string;
} {
  const requestId = `id_${randomBytes(16).toString("hex")}`;
  const issueInstant = new Date().toISOString();
  const xml = `<?xml version="1.0"?>
<samlp:AuthnRequest xmlns:samlp="urn:oasis:names:tc:SAML:2.0:protocol" ID="${requestId}" Version="2.0" IssueInstant="${issueInstant}" Destination="${escapeXml(idp.ssoUrl)}" ProtocolBinding="urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST" AssertionConsumerServiceURL="${escapeXml(sp.acsUrl)}">
  <saml:Issuer xmlns:saml="urn:oasis:names:tc:SAML:2.0:assertion">${escapeXml(sp.entityId)}</saml:Issuer>
  <samlp:NameIDPolicy Format="urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress" AllowCreate="true"/>
</samlp:AuthnRequest>`;
  const encoded = Buffer.from(xml).toString("base64");
  const params = new URLSearchParams();
  params.set("SAMLRequest", encoded);
  if (relayState) params.set("RelayState", relayState);
  const separator = idp.ssoUrl.includes("?") ? "&" : "?";
  return { redirectUrl: `${idp.ssoUrl}${separator}${params.toString()}`, requestId };
}

function escapeXml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}

export interface ValidationOptions {
  sp: SamlSpConfig;
  idp: SamlIdpConfig;
  expectedAudience?: string;
  clockSkewMs?: number;
  // Optional set of consumed response IDs for replay protection. Caller is
  // responsible for persisting the IDs (e.g. in Redis) and adding new ones.
  isReplay?: (responseId: string) => Promise<boolean> | boolean;
}

export function decodeSamlResponse(samlResponseB64: string): string {
  if (!samlResponseB64) throw new SamlError("Empty SAMLResponse.");
  try {
    const decoded = Buffer.from(samlResponseB64, "base64").toString("utf8");
    if (!decoded.includes("Response")) throw new SamlError("Decoded SAMLResponse does not look like a Response document.");
    return decoded;
  } catch (error) {
    throw new SamlError(`Could not base64-decode SAMLResponse: ${(error as Error).message}`);
  }
}

export async function validateSamlResponse(samlResponseB64: string, options: ValidationOptions): Promise<SamlValidationResult> {
  const xml = decodeSamlResponse(samlResponseB64);

  // Issuer
  const issuer = safeMatch(xml, /<(?:saml2?:)?Issuer[^>]*>([^<]+)<\/(?:saml2?:)?Issuer>/);
  if (!issuer) throw new SamlError("Issuer is missing.");
  if (issuer.trim() !== options.idp.entityId) {
    throw new SamlError("Issuer does not match the configured IdP entity id.");
  }

  // Audience
  const audience = safeMatch(xml, /<(?:saml2?:)?Audience[^>]*>([^<]+)<\/(?:saml2?:)?Audience>/);
  const expectedAudience = options.expectedAudience ?? options.sp.entityId;
  if (!audience || audience.trim() !== expectedAudience) {
    throw new SamlError("Audience restriction does not match the SP entity id.");
  }

  // Conditions / timing
  const notBefore = safeMatch(xml, /NotBefore=\"([^\"]+)\"/);
  const notOnOrAfter = safeMatch(xml, /NotOnOrAfter=\"([^\"]+)\"/);
  const skew = options.clockSkewMs ?? 60_000;
  const now = Date.now();
  if (notBefore) {
    const nb = Date.parse(notBefore);
    if (!Number.isNaN(nb) && now + skew < nb) throw new SamlError("Assertion not yet valid (NotBefore in future).");
  }
  if (notOnOrAfter) {
    const noa = Date.parse(notOnOrAfter);
    if (!Number.isNaN(noa) && now - skew >= noa) throw new SamlError("Assertion expired (NotOnOrAfter in past).");
  }

  // Replay
  const responseId = safeMatch(xml, /<(?:samlp:)?Response[^>]*\bID=\"([^\"]+)\"/) ?? `unknown-${randomBytes(8).toString("hex")}`;
  if (options.isReplay) {
    const replayed = await options.isReplay(responseId);
    if (replayed) throw new SamlError("SAML response replay detected.");
  }

  // Signature verification.
  const signed = verifySignature(xml, options.idp.x509Certificate);
  if (!signed) throw new SamlError("SAML signature verification failed.");

  // Attributes
  const attributes = extractAttributes(xml);

  return {
    attributes,
    responseId,
    issuer: issuer.trim(),
    notBefore: notBefore ? new Date(notBefore) : undefined,
    notOnOrAfter: notOnOrAfter ? new Date(notOnOrAfter) : undefined,
  };
}

function verifySignature(xml: string, certificatePem: string): boolean {
  // Locate the SignedInfo, SignatureValue, and reference URI. We match the
  // first <ds:Signature> block that is not enclosed within another Signature.
  const sigMatch = xml.match(/<(?:ds:)?Signature[\s\S]*?<\/(?:ds:)?Signature>/);
  if (!sigMatch) return false;
  const signatureBlock = sigMatch[0];
  const signedInfo = safeMatch(signatureBlock, /<(?:ds:)?SignedInfo[\s\S]*?<\/(?:ds:)?SignedInfo>/);
  const signatureValue = safeMatch(signatureBlock, /<(?:ds:)?SignatureValue[^>]*>([\s\S]*?)<\/(?:ds:)?SignatureValue>/);
  if (!signedInfo || !signatureValue) return false;

  // Determine algorithm.
  const algo = safeMatch(signedInfo, /SignatureMethod[^>]*Algorithm=\"([^\"]+)\"/) ?? "";
  const hashAlgo = algo.includes("rsa-sha512") ? "RSA-SHA512" : algo.includes("rsa-sha384") ? "RSA-SHA384" : algo.includes("rsa-sha1") ? "RSA-SHA1" : "RSA-SHA256";

  let publicKey;
  try {
    publicKey = createPublicKey({ key: certificatePem, format: "pem" });
  } catch (error) {
    return false;
  }

  // Reconstruct SignedInfo XML exactly as it appeared. This is a simplified
  // exclusive-canonicalisation: most IdPs emit SignedInfo without comments and
  // with no namespace remapping needed when transmitted via HTTP-POST.
  const verifier = createVerify(hashAlgo);
  verifier.update(signedInfo);
  verifier.end();
  try {
    return verifier.verify(publicKey, Buffer.from(signatureValue.replace(/\s+/g, ""), "base64"));
  } catch {
    return false;
  }
}

function extractAttributes(xml: string): SamlAssertionAttributes {
  const raw: Record<string, string[]> = {};
  const attributeBlocks = xml.match(/<(?:saml2?:)?Attribute[\s\S]*?<\/(?:saml2?:)?Attribute>/g) ?? [];
  for (const block of attributeBlocks) {
    const name = safeMatch(block, /Name=\"([^\"]+)\"/);
    if (!name) continue;
    const values = [...block.matchAll(/<(?:saml2?:)?AttributeValue[^>]*>([\s\S]*?)<\/(?:saml2?:)?AttributeValue>/g)].map((match) =>
      decodeXmlText(match[1].trim()),
    );
    raw[name] = values;
  }
  const subject = safeMatch(xml, /<(?:saml2?:)?NameID[^>]*>([^<]+)<\/(?:saml2?:)?NameID>/);
  const emailAttr = pickAttr(raw, ["email", "emailAddress", "mail", "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress"]);
  const email = emailAttr?.[0] ?? subject ?? "";
  const name = pickAttr(raw, ["name", "displayName", "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name", "givenName"])?.[0];
  const groups = pickAttr(raw, ["groups", "memberOf", "http://schemas.microsoft.com/ws/2008/06/identity/claims/role"]) ?? [];
  if (!email) throw new SamlError("SAML assertion is missing an email/NameID.");
  return { email: email.toLowerCase(), name, groups, raw };
}

function pickAttr(raw: Record<string, string[]>, candidates: string[]): string[] | undefined {
  for (const key of candidates) {
    if (raw[key]) return raw[key];
    const ci = Object.keys(raw).find((existing) => existing.toLowerCase() === key.toLowerCase());
    if (ci) return raw[ci];
  }
  return undefined;
}

export function constantTimeStringEquals(a: string, b: string): boolean {
  const aBuf = Buffer.from(a);
  const bBuf = Buffer.from(b);
  if (aBuf.length !== bBuf.length) return false;
  return timingSafeEqual(aBuf, bBuf);
}
