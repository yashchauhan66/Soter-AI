<?php
/**
 * REST proxy endpoints for SoterAI Guard.
 *
 * @package Soter_Guard
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Exposes /wp-json/soter/v1/guard-input and guard-output. These run
 * server-side so the API key never reaches the browser. Includes a lightweight
 * per-IP rate limit using transients.
 */
class Soter_Rest {

	/**
	 * Singleton instance.
	 *
	 * @var Soter_Rest|null
	 */
	private static $instance = null;

	/**
	 * Get instance.
	 *
	 * @return Soter_Rest
	 */
	public static function instance() {
		if ( null === self::$instance ) {
			self::$instance = new self();
		}
		return self::$instance;
	}

	/**
	 * Constructor.
	 */
	private function __construct() {
		add_action( 'rest_api_init', array( $this, 'register_routes' ) );
	}

	/**
	 * Register the public proxy routes.
	 *
	 * @return void
	 */
	public function register_routes() {
		register_rest_route(
			'soter/v1',
			'/guard-input',
			array(
				'methods'             => 'POST',
				'callback'            => array( $this, 'guard_input' ),
				'permission_callback' => array( $this, 'permission' ),
				'args'                => array(
					'text' => array(
						'required'          => true,
						'type'              => 'string',
						'sanitize_callback' => array( $this, 'sanitize_text' ),
					),
				),
			)
		);
		register_rest_route(
			'soter/v1',
			'/guard-output',
			array(
				'methods'             => 'POST',
				'callback'            => array( $this, 'guard_output' ),
				'permission_callback' => array( $this, 'permission' ),
				'args'                => array(
					'text' => array(
						'required'          => true,
						'type'              => 'string',
						'sanitize_callback' => array( $this, 'sanitize_text' ),
					),
				),
			)
		);
	}

	/**
	 * Sanitize incoming text. Keeps newlines; strips tags and control bytes.
	 *
	 * @param mixed $value Raw value.
	 * @return string
	 */
	public function sanitize_text( $value ) {
		$value = is_string( $value ) ? $value : '';
		return sanitize_textarea_field( $value );
	}

	/**
	 * Permission callback: nonce verification + per-IP rate limit.
	 *
	 * @param WP_REST_Request $request Request.
	 * @return bool|WP_Error
	 */
	public function permission( $request ) {
		$nonce = $request->get_header( 'x-wp-nonce' );
		if ( ! $nonce || ! wp_verify_nonce( $nonce, 'wp_rest' ) ) {
			return new WP_Error( 'rest_forbidden', __( 'Invalid or missing nonce.', 'soter-guard' ), array( 'status' => 403 ) );
		}
		if ( ! $this->within_rate_limit() ) {
			return new WP_Error( 'rest_rate_limited', __( 'Too many requests. Please slow down.', 'soter-guard' ), array( 'status' => 429 ) );
		}
		return true;
	}

	/**
	 * Simple per-IP transient rate limit.
	 *
	 * @return bool
	 */
	private function within_rate_limit() {
		$settings = Soter_Settings::get();
		$limit    = isset( $settings['rate_limit'] ) ? (int) $settings['rate_limit'] : 30;
		$ip       = $this->client_ip();
		$key      = 'crg_rl_' . md5( $ip );
		$count    = (int) get_transient( $key );
		if ( $count >= $limit ) {
			return false;
		}
		set_transient( $key, $count + 1, MINUTE_IN_SECONDS );
		return true;
	}

	/**
	 * Best-effort client IP, never trusted for security decisions beyond rate limiting.
	 *
	 * @return string
	 */
	private function client_ip() {
		$ip = isset( $_SERVER['REMOTE_ADDR'] ) ? sanitize_text_field( wp_unslash( $_SERVER['REMOTE_ADDR'] ) ) : 'unknown';
		return $ip;
	}

	/**
	 * Handle guard-input.
	 *
	 * @param WP_REST_Request $request Request.
	 * @return WP_REST_Response
	 */
	public function guard_input( $request ) {
		$settings = Soter_Settings::get();
		if ( empty( $settings['enable_input'] ) ) {
			return $this->passthrough( (string) $request->get_param( 'text' ) );
		}
		$client = new Soter_Client();
		$result = $client->guard_input( (string) $request->get_param( 'text' ) );
		return $this->public_response( $result );
	}

	/**
	 * Handle guard-output.
	 *
	 * @param WP_REST_Request $request Request.
	 * @return WP_REST_Response
	 */
	public function guard_output( $request ) {
		$settings = Soter_Settings::get();
		if ( empty( $settings['enable_output'] ) ) {
			return $this->passthrough( (string) $request->get_param( 'text' ) );
		}
		$client = new Soter_Client();
		$result = $client->guard_output( (string) $request->get_param( 'text' ) );
		return $this->public_response( $result );
	}

	/**
	 * Pass text through unchanged when a guard is disabled.
	 *
	 * @param string $text Text.
	 * @return WP_REST_Response
	 */
	private function passthrough( $text ) {
		return new WP_REST_Response(
			array(
				'blocked'   => false,
				'decision'  => 'ALLOW',
				'safe_text' => $text,
			),
			200
		);
	}

	/**
	 * Build a public, secret-free response payload.
	 *
	 * @param array $result Normalized client result.
	 * @return WP_REST_Response
	 */
	private function public_response( $result ) {
		return new WP_REST_Response(
			array(
				'blocked'    => ! empty( $result['blocked'] ),
				'decision'   => isset( $result['decision'] ) ? $result['decision'] : 'ALLOW',
				'safe_text'  => isset( $result['safe_text'] ) ? $result['safe_text'] : '',
				'risk_types' => isset( $result['risk_types'] ) ? $result['risk_types'] : array(),
			),
			200
		);
	}
}
