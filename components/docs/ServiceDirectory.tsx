"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ArrowRight, Search, X } from "lucide-react";
import { DocsHeading } from "@/components/docs/DocsHeading";
import { EmptyState } from "@/components/docs/EmptyState";
import { SERVICES, SERVICE_GROUPS } from "@/lib/docs/services";

export function ServiceDirectory() {
  const [query, setQuery] = useState("");
  const [group, setGroup] = useState("all");
  const searchRef = useRef<HTMLInputElement>(null);
  const normalizedQuery = query.trim().toLowerCase();
  const filteredServices = useMemo(() => SERVICES.filter((service) => {
    const inGroup = group === "all" || service.group === group;
    const groupLabel = SERVICE_GROUPS.find((item) => item.id === service.group)?.label ?? "";
    const searchable = `${service.id} ${service.title} ${service.description} ${service.longDescription} ${service.apiEndpoint ?? ""} ${groupLabel}`.toLowerCase();
    return inGroup && (!normalizedQuery || searchable.includes(normalizedQuery));
  }), [group, normalizedQuery]);

  return (
    <section className="docs-service-directory" aria-labelledby="service-directory-heading">
      <div className="docs-service-header">
        <div>
          <DocsHeading id="service-directory-heading">Find the control you need</DocsHeading>
          <p>Search by service, outcome, or route reference.</p>
        </div>
        <div className="docs-service-search">
          <label htmlFor="docs-service-query" className="sr-only">Search security services</label>
          <Search size={17} aria-hidden="true" />
          <input ref={searchRef} id="docs-service-query" type="search" value={query}
            onChange={(event) => setQuery(event.target.value)} placeholder="Filter services or endpoints"
            aria-describedby="docs-service-count" />
          {query && <button type="button" onClick={() => { setQuery(""); searchRef.current?.focus(); }} aria-label="Clear service search">
            <X size={16} aria-hidden="true" />
          </button>}
        </div>
      </div>

      <div className="docs-service-filters" role="group" aria-label="Filter services by category">
        <button type="button" onClick={() => setGroup("all")} aria-pressed={group === "all"}>
          All <span>{SERVICES.length}</span>
        </button>
        {SERVICE_GROUPS.map((item) => (
          <button key={item.id} type="button" onClick={() => setGroup(item.id)} aria-pressed={group === item.id}>
            {item.label} <span>{SERVICES.filter((service) => service.group === item.id).length}</span>
          </button>
        ))}
      </div>
      <div className="docs-service-status">
        <p id="docs-service-count" aria-live="polite">{filteredServices.length} {filteredServices.length === 1 ? "service" : "services"} shown</p>
        <p>Each guide explains setup and access requirements.</p>
      </div>

      {filteredServices.length > 0 ? (
        <ul className="docs-service-results">
          {filteredServices.map((service) => (
            <li key={service.id}>
              <Link href={`/docs/services/${service.id}`} className="docs-service-row">
                <div className="docs-service-main">
                  <h3>{service.title}</h3>
                  <p>{service.description}</p>
                </div>
                <div className="docs-service-reference">
                  <span>{SERVICE_GROUPS.find((item) => item.id === service.group)?.label}</span>
                  <code>{service.apiEndpoint ?? "Dashboard setup"}</code>
                </div>
                <ArrowRight size={16} aria-hidden="true" className="docs-service-arrow" />
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <div className="docs-service-empty">
          <EmptyState title="No matching services" message="Try a broader term or reset the category and search filters." icon={Search} />
          <button type="button" className="docs-button" onClick={() => { setQuery(""); setGroup("all"); searchRef.current?.focus(); }}>
            Reset filters
          </button>
        </div>
      )}
    </section>
  );
}
