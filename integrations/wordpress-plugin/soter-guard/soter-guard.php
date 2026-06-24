<?php
/**
 * Plugin Name:       SoterAI Guard
 * Plugin URI:        https://soterai.publicvm.com
 * Description:        OWASP LLM Top 10 aligned AI security gateway for chatbots. Guards chatbot input and output through the SoterAI Guard API. Reduces risk via detect, block, redact, monitor, and report. Does not guarantee complete protection.
 * Version:           0.1.0
 * Requires at least: 5.8
 * Requires PHP:      7.4
 * Author:            SoterAI
 * License:           GPL-2.0-or-later
 * License URI:       https://www.gnu.org/licenses/gpl-2.0.html
 * Text Domain:       soter-guard
 *
 * @package Soter_Guard
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit; // No direct access.
}

define( 'SOTER_GUARD_VERSION', '0.1.0' );
define( 'SOTER_GUARD_FILE', __FILE__ );
define( 'SOTER_GUARD_DIR', plugin_dir_path( __FILE__ ) );
define( 'SOTER_GUARD_URL', plugin_dir_url( __FILE__ ) );
define( 'SOTER_GUARD_OPTION', 'soter_guard_settings' );

require_once SOTER_GUARD_DIR . 'includes/class-soter-settings.php';
require_once SOTER_GUARD_DIR . 'includes/class-soter-client.php';
require_once SOTER_GUARD_DIR . 'includes/class-soter-admin.php';
require_once SOTER_GUARD_DIR . 'includes/class-soter-rest.php';
require_once SOTER_GUARD_DIR . 'includes/class-soter-shortcode.php';

/**
 * Boot the plugin.
 */
function soter_guard_init() {
	Soter_Settings::instance();
	Soter_Admin::instance();
	Soter_Rest::instance();
	Soter_Shortcode::instance();
}
add_action( 'plugins_loaded', 'soter_guard_init' );

/**
 * Public PHP helper: guard a user input string server-side.
 *
 * @param string $text Raw user message.
 * @return array{blocked:bool,safe_text:string,decision:string,result:array}
 */
function soter_guard_input( $text ) {
	$client = new Soter_Client();
	return $client->guard_input( (string) $text );
}

/**
 * Public PHP helper: guard an AI output string server-side.
 *
 * @param string $text AI/chatbot response.
 * @return array{blocked:bool,safe_text:string,decision:string,result:array}
 */
function soter_guard_output( $text ) {
	$client = new Soter_Client();
	return $client->guard_output( (string) $text );
}

register_activation_hook(
	__FILE__,
	static function () {
		if ( false === get_option( SOTER_GUARD_OPTION ) ) {
			add_option( SOTER_GUARD_OPTION, Soter_Settings::defaults() );
		}
	}
);
