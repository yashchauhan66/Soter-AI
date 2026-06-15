<?php
/**
 * Plugin Name:       CyberRakshak Guard
 * Plugin URI:        https://cyberrakshak.dev
 * Description:        OWASP LLM Top 10 aligned AI security gateway for chatbots. Guards chatbot input and output through the CyberRakshak Guard API. Reduces risk via detect, block, redact, monitor, and report. Does not guarantee complete protection.
 * Version:           0.1.0
 * Requires at least: 5.8
 * Requires PHP:      7.4
 * Author:            CyberRakshak
 * License:           GPL-2.0-or-later
 * License URI:       https://www.gnu.org/licenses/gpl-2.0.html
 * Text Domain:       cyberrakshak-guard
 *
 * @package CyberRakshak_Guard
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit; // No direct access.
}

define( 'CYBERRAKSHAK_GUARD_VERSION', '0.1.0' );
define( 'CYBERRAKSHAK_GUARD_FILE', __FILE__ );
define( 'CYBERRAKSHAK_GUARD_DIR', plugin_dir_path( __FILE__ ) );
define( 'CYBERRAKSHAK_GUARD_URL', plugin_dir_url( __FILE__ ) );
define( 'CYBERRAKSHAK_GUARD_OPTION', 'cyberrakshak_guard_settings' );

require_once CYBERRAKSHAK_GUARD_DIR . 'includes/class-cyberrakshak-settings.php';
require_once CYBERRAKSHAK_GUARD_DIR . 'includes/class-cyberrakshak-client.php';
require_once CYBERRAKSHAK_GUARD_DIR . 'includes/class-cyberrakshak-admin.php';
require_once CYBERRAKSHAK_GUARD_DIR . 'includes/class-cyberrakshak-rest.php';
require_once CYBERRAKSHAK_GUARD_DIR . 'includes/class-cyberrakshak-shortcode.php';

/**
 * Boot the plugin.
 */
function cyberrakshak_guard_init() {
	CyberRakshak_Settings::instance();
	CyberRakshak_Admin::instance();
	CyberRakshak_Rest::instance();
	CyberRakshak_Shortcode::instance();
}
add_action( 'plugins_loaded', 'cyberrakshak_guard_init' );

/**
 * Public PHP helper: guard a user input string server-side.
 *
 * @param string $text Raw user message.
 * @return array{blocked:bool,safe_text:string,decision:string,result:array}
 */
function cyberrakshak_guard_input( $text ) {
	$client = new CyberRakshak_Client();
	return $client->guard_input( (string) $text );
}

/**
 * Public PHP helper: guard an AI output string server-side.
 *
 * @param string $text AI/chatbot response.
 * @return array{blocked:bool,safe_text:string,decision:string,result:array}
 */
function cyberrakshak_guard_output( $text ) {
	$client = new CyberRakshak_Client();
	return $client->guard_output( (string) $text );
}

register_activation_hook(
	__FILE__,
	static function () {
		if ( false === get_option( CYBERRAKSHAK_GUARD_OPTION ) ) {
			add_option( CYBERRAKSHAK_GUARD_OPTION, CyberRakshak_Settings::defaults() );
		}
	}
);
