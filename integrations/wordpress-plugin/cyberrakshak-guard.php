<?php
/**
 * Plugin Name: CyberRakshak Guard
 * Description: Defensive AI guard wrapper for owned WordPress chatbot flows.
 * Version: 0.1.0
 * Author: CyberRakshak Guard
 */

if (!defined('ABSPATH')) {
  exit;
}

define('CYBERRAKSHAK_GUARD_OPTION', 'cyberrakshak_guard_settings');

add_action('admin_menu', function () {
  add_options_page('CyberRakshak Guard', 'CyberRakshak Guard', 'manage_options', 'cyberrakshak-guard', 'cyberrakshak_guard_settings_page');
});

add_action('admin_init', function () {
  register_setting('cyberrakshak_guard', CYBERRAKSHAK_GUARD_OPTION, [
    'sanitize_callback' => 'cyberrakshak_guard_sanitize_settings',
  ]);
});

function cyberrakshak_guard_sanitize_settings($input) {
  return [
    'api_base_url' => esc_url_raw($input['api_base_url'] ?? ''),
    'api_key' => sanitize_text_field($input['api_key'] ?? ''),
    'project_id' => sanitize_text_field($input['project_id'] ?? ''),
    'input_guard' => !empty($input['input_guard']) ? '1' : '0',
    'output_guard' => !empty($input['output_guard']) ? '1' : '0',
    'show_badge' => !empty($input['show_badge']) ? '1' : '0',
  ];
}

function cyberrakshak_guard_settings_page() {
  if (!current_user_can('manage_options')) {
    return;
  }
  $settings = get_option(CYBERRAKSHAK_GUARD_OPTION, []);
  ?>
  <div class="wrap">
    <h1>CyberRakshak Guard</h1>
    <form method="post" action="options.php">
      <?php settings_fields('cyberrakshak_guard'); ?>
      <table class="form-table" role="presentation">
        <tr><th scope="row">API Base URL</th><td><input type="url" name="<?php echo esc_attr(CYBERRAKSHAK_GUARD_OPTION); ?>[api_base_url]" value="<?php echo esc_attr($settings['api_base_url'] ?? ''); ?>" class="regular-text" /></td></tr>
        <tr><th scope="row">API Key</th><td><input type="password" name="<?php echo esc_attr(CYBERRAKSHAK_GUARD_OPTION); ?>[api_key]" value="<?php echo esc_attr($settings['api_key'] ?? ''); ?>" class="regular-text" autocomplete="off" /></td></tr>
        <tr><th scope="row">Project ID</th><td><input type="text" name="<?php echo esc_attr(CYBERRAKSHAK_GUARD_OPTION); ?>[project_id]" value="<?php echo esc_attr($settings['project_id'] ?? ''); ?>" class="regular-text" /></td></tr>
        <tr><th scope="row">Input Guard</th><td><label><input type="checkbox" name="<?php echo esc_attr(CYBERRAKSHAK_GUARD_OPTION); ?>[input_guard]" value="1" <?php checked(($settings['input_guard'] ?? '') === '1'); ?> /> Enable input guard</label></td></tr>
        <tr><th scope="row">Output Guard</th><td><label><input type="checkbox" name="<?php echo esc_attr(CYBERRAKSHAK_GUARD_OPTION); ?>[output_guard]" value="1" <?php checked(($settings['output_guard'] ?? '') === '1'); ?> /> Enable output guard</label></td></tr>
        <tr><th scope="row">Security Badge</th><td><label><input type="checkbox" name="<?php echo esc_attr(CYBERRAKSHAK_GUARD_OPTION); ?>[show_badge]" value="1" <?php checked(($settings['show_badge'] ?? '') === '1'); ?> /> Show badge</label></td></tr>
      </table>
      <?php submit_button(); ?>
    </form>
    <p>Use shortcode <code>[cyberrakshak_guard_chatbot]</code> to wrap an owned chatbot container. API keys are stored server-side only and must not be exposed in frontend JavaScript.</p>
  </div>
  <?php
}

add_shortcode('cyberrakshak_guard_chatbot', function ($atts, $content = null) {
  $settings = get_option(CYBERRAKSHAK_GUARD_OPTION, []);
  $badge = (($settings['show_badge'] ?? '') === '1') ? '<div class="cyberrakshak-guard-badge">Protected by CyberRakshak Guard</div>' : '';
  return '<div class="cyberrakshak-guard-chatbot">' . do_shortcode($content ?? '') . $badge . '</div>';
});

