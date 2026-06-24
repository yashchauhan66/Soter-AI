<?php
/**
 * Server-side HTTP client for the SoterAI Guard API.
 *
 * @package Soter_Guard
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Wraps wp_remote_post calls to the Guard API. The API key is read from stored
 * options and sent only in the x-api-key header. It is never returned to the
 * frontend or logged.
 */
class Soter_Client {

	/**
	 * Plugin settings.
	 *
	 * @var array
	 */
	private $settings;

	/**
	 * Constructor.
	 */
	public function __construct() {
		$this->settings = Soter_Settings::get();
	}

	/**
	 * Whether the client has enough configuration to make calls.
	 *
	 * @return bool
	 */
	public function is_configured() {
		return ! empty( $this->settings['api_key'] ) && ! empty( $this->settings['base_url'] );
	}

	/**
	 * Guard a user input string.
	 *
	 * @param string $text User message.
	 * @return array
	 */
	public function guard_input( $text ) {
		$body = array( 'message' => $text );
		if ( ! empty( $this->settings['project_id'] ) ) {
			$body['metadata'] = array( 'projectId' => $this->settings['project_id'] );
		}
		return $this->normalize( $this->request( '/api/guard/input', $body, true ), $text );
	}

	/**
	 * Guard an AI output string.
	 *
	 * @param string $text AI response.
	 * @return array
	 */
	public function guard_output( $text ) {
		$body = array( 'aiResponse' => $text );
		if ( ! empty( $this->settings['project_id'] ) ) {
			$body['metadata'] = array( 'projectId' => $this->settings['project_id'] );
		}
		return $this->normalize( $this->request( '/api/guard/output', $body, true ), $text );
	}

	/**
	 * Test connectivity using the public analyze endpoint (no key needed) and an
	 * authenticated input call to confirm the API key works.
	 *
	 * @return array{ok:bool,message:string}
	 */
	public function test_connection() {
		if ( ! $this->is_configured() ) {
			return array(
				'ok'      => false,
				'message' => __( 'API Base URL and API Key are required.', 'soter-guard' ),
			);
		}
		$response = $this->request( '/api/guard/input', array( 'message' => 'SoterAI connection test.' ), true );
		if ( is_wp_error( $response ) ) {
			return array(
				'ok'      => false,
				'message' => $response->get_error_message(),
			);
		}
		$code = (int) wp_remote_retrieve_response_code( $response );
		if ( 200 === $code ) {
			return array(
				'ok'      => true,
				'message' => __( 'Connection successful. The Guard API responded.', 'soter-guard' ),
			);
		}
		if ( 401 === $code || 403 === $code ) {
			return array(
				'ok'      => false,
				'message' => __( 'Authentication failed. Check the API key.', 'soter-guard' ),
			);
		}
		/* translators: %d: HTTP status code. */
		return array(
			'ok'      => false,
			'message' => sprintf( __( 'Unexpected response from the Guard API (HTTP %d).', 'soter-guard' ), $code ),
		);
	}

	/**
	 * Perform a POST request to the Guard API.
	 *
	 * @param string $path           API path.
	 * @param array  $body           Request body.
	 * @param bool   $require_api_key Whether to send the x-api-key header.
	 * @return array|WP_Error
	 */
	private function request( $path, $body, $require_api_key ) {
		$url     = rtrim( $this->settings['base_url'], '/' ) . $path;
		$headers = array(
			'Content-Type' => 'application/json',
			'User-Agent'   => 'soter-guard-wp/' . SOTER_GUARD_VERSION,
		);
		if ( $require_api_key ) {
			$headers['x-api-key'] = $this->settings['api_key'];
		}
		return wp_remote_post(
			$url,
			array(
				'timeout'     => isset( $this->settings['timeout'] ) ? (int) $this->settings['timeout'] : 5,
				'headers'     => $headers,
				'body'        => wp_json_encode( $body ),
				'data_format' => 'body',
			)
		);
	}

	/**
	 * Normalize a wp_remote_post response into a stable result array.
	 *
	 * @param array|WP_Error $response Raw response.
	 * @param string         $original Original text (used as safe fallback).
	 * @return array
	 */
	private function normalize( $response, $original ) {
		$block_message = isset( $this->settings['block_message'] ) ? $this->settings['block_message'] : 'This request was blocked for safety.';

		// Fail closed for inputs is unsafe for UX; we fail open but flag it so the
		// site keeps working if the Guard is unreachable. Output guarding callers
		// can choose to withhold on error.
		if ( is_wp_error( $response ) ) {
			return array(
				'blocked'    => false,
				'error'      => true,
				'decision'   => 'ALLOW',
				'safe_text'  => $original,
				'reason'     => __( 'Guard API unreachable; request passed through.', 'soter-guard' ),
				'risk_types' => array(),
			);
		}

		$code = (int) wp_remote_retrieve_response_code( $response );
		$data = json_decode( wp_remote_retrieve_body( $response ), true );
		if ( ! is_array( $data ) ) {
			$data = array();
		}

		if ( $code >= 400 ) {
			return array(
				'blocked'    => ( 429 === $code ),
				'error'      => true,
				'decision'   => ( 429 === $code ) ? 'BLOCK' : 'ALLOW',
				'safe_text'  => ( 429 === $code ) ? $block_message : $original,
				'reason'     => isset( $data['message'] ) ? sanitize_text_field( $data['message'] ) : 'guard_error',
				'risk_types' => array(),
			);
		}

		$action   = isset( $data['action'] ) ? $data['action'] : 'ALLOW';
		$decision = $this->decision_for( $action );
		$allowed  = isset( $data['allowed'] ) ? (bool) $data['allowed'] : ( 'ALLOW' === $action );
		$blocked  = ( ! $allowed ) || in_array( $decision, array( 'BLOCK', 'HUMAN_REVIEW' ), true );

		$safe_text = $original;
		if ( ! empty( $data['safeText'] ) ) {
			$safe_text = $data['safeText'];
		} elseif ( ! empty( $data['redactedText'] ) ) {
			$safe_text = $data['redactedText'];
		}
		if ( $blocked ) {
			$safe_text = ! empty( $data['safeText'] ) ? $data['safeText'] : $block_message;
		}

		return array(
			'blocked'    => $blocked,
			'error'      => false,
			'decision'   => $decision,
			'action'     => $action,
			'safe_text'  => $safe_text,
			'reason'     => isset( $data['reason'] ) ? $data['reason'] : '',
			'risk_types' => isset( $data['riskTypes'] ) && is_array( $data['riskTypes'] ) ? $data['riskTypes'] : array(),
		);
	}

	/**
	 * Map the API action onto a normalized decision.
	 *
	 * @param string $action API action.
	 * @return string
	 */
	private function decision_for( $action ) {
		switch ( $action ) {
			case 'ALLOW':
				return 'ALLOW';
			case 'ALLOW_WITH_REDACTION':
			case 'REWRITE':
				return 'REDACT';
			case 'HUMAN_REVIEW':
				return 'HUMAN_REVIEW';
			default:
				return 'BLOCK';
		}
	}
}
