<?php
/**
 * Settings store for SoterAI Guard.
 *
 * @package Soter_Guard
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Registers and sanitizes plugin settings. The API key is stored in the WP
 * options table and never exposed to the frontend.
 */
class Soter_Settings {

	/**
	 * Singleton instance.
	 *
	 * @var Soter_Settings|null
	 */
	private static $instance = null;

	/**
	 * Get instance.
	 *
	 * @return Soter_Settings
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
		add_action( 'admin_init', array( $this, 'register' ) );
	}

	/**
	 * Default settings.
	 *
	 * @return array
	 */
	public static function defaults() {
		return array(
			'base_url'      => 'https://api.soterai.publicvm.com',
			'api_key'       => '',
			'project_id'    => '',
			'enable_input'  => 1,
			'enable_output' => 1,
			'enable_badge'  => 0,
			'block_message' => 'This request was blocked for safety.',
			'timeout'       => 5,
			'rate_limit'    => 30,
		);
	}

	/**
	 * Get a merged copy of current settings.
	 *
	 * @return array
	 */
	public static function get() {
		$stored = get_option( SOTER_GUARD_OPTION, array() );
		if ( ! is_array( $stored ) ) {
			$stored = array();
		}
		return wp_parse_args( $stored, self::defaults() );
	}

	/**
	 * Register the setting and its sanitizer.
	 *
	 * @return void
	 */
	public function register() {
		register_setting(
			'soter_guard_group',
			SOTER_GUARD_OPTION,
			array(
				'type'              => 'array',
				'sanitize_callback' => array( $this, 'sanitize' ),
				'default'           => self::defaults(),
			)
		);
	}

	/**
	 * Sanitize settings before persisting. Preserves the stored API key when the
	 * submitted value is the masked placeholder.
	 *
	 * @param array $input Raw submitted values.
	 * @return array
	 */
	public function sanitize( $input ) {
		$existing  = self::get();
		$sanitized = self::defaults();

		$base_url = isset( $input['base_url'] ) ? esc_url_raw( trim( (string) $input['base_url'] ) ) : '';
		if ( $base_url && 0 === strpos( $base_url, 'https://' ) ) {
			$sanitized['base_url'] = $base_url;
		} else {
			$sanitized['base_url'] = $existing['base_url'];
			add_settings_error( SOTER_GUARD_OPTION, 'base_url', __( 'API Base URL must be a valid https:// URL.', 'soter-guard' ) );
		}

		$submitted_key = isset( $input['api_key'] ) ? trim( (string) $input['api_key'] ) : '';
		if ( '' === $submitted_key || $this->is_masked( $submitted_key ) ) {
			$sanitized['api_key'] = $existing['api_key'];
		} else {
			$sanitized['api_key'] = sanitize_text_field( $submitted_key );
		}

		$sanitized['project_id']    = isset( $input['project_id'] ) ? sanitize_text_field( (string) $input['project_id'] ) : '';
		$sanitized['enable_input']  = empty( $input['enable_input'] ) ? 0 : 1;
		$sanitized['enable_output'] = empty( $input['enable_output'] ) ? 0 : 1;
		$sanitized['enable_badge']  = empty( $input['enable_badge'] ) ? 0 : 1;
		$sanitized['block_message'] = isset( $input['block_message'] ) ? sanitize_text_field( (string) $input['block_message'] ) : self::defaults()['block_message'];

		$timeout              = isset( $input['timeout'] ) ? absint( $input['timeout'] ) : 5;
		$sanitized['timeout'] = ( $timeout >= 1 && $timeout <= 30 ) ? $timeout : 5;

		$rate                    = isset( $input['rate_limit'] ) ? absint( $input['rate_limit'] ) : 30;
		$sanitized['rate_limit'] = ( $rate >= 1 && $rate <= 240 ) ? $rate : 30;

		return $sanitized;
	}

	/**
	 * Whether a value is the masked placeholder used in the admin field.
	 *
	 * @param string $value Submitted value.
	 * @return bool
	 */
	private function is_masked( $value ) {
		return (bool) preg_match( '/^\*+$/', $value );
	}
}
