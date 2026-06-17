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

add_action('admin_enqueue_scripts', function ($hook) {
  if ($hook !== 'settings_page_cyberrakshak-guard') {
    return;
  }
  wp_enqueue_script('cyberrakshak-guard-admin', plugin_dir_url(__FILE__) . 'assets/admin.js', [], '0.1.0', true);
  wp_localize_script('cyberrakshak-guard-admin', 'CyberRakshakGuardAdmin', [
    'ajaxUrl' => admin_url('admin-ajax.php'),
    'nonce' => wp_create_nonce('cyberrakshak_guard_test'),
  ]);
});

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
    'document_guard' => !empty($input['document_guard']) ? '1' : '0',
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
        <tr><th scope="row">Document/RAG Scan</th><td><label><input type="checkbox" name="<?php echo esc_attr(CYBERRAKSHAK_GUARD_OPTION); ?>[document_guard]" value="1" <?php checked(($settings['document_guard'] ?? '') === '1'); ?> /> Enable document/RAG scan where supported</label></td></tr>
        <tr><th scope="row">Security Badge</th><td><label><input type="checkbox" name="<?php echo esc_attr(CYBERRAKSHAK_GUARD_OPTION); ?>[show_badge]" value="1" <?php checked(($settings['show_badge'] ?? '') === '1'); ?> /> Show badge</label></td></tr>
      </table>
      <?php submit_button(); ?>
    </form>
    <p><button type="button" class="button button-secondary" data-cyberrakshak-test>Test connection</button> <span data-cyberrakshak-test-result></span></p>
    <p>Use shortcode <code>[cyberrakshak_chatbot_guard]</code> to wrap an owned chatbot container. API keys are stored server-side only and must not be exposed in frontend JavaScript.</p>
  </div>
  <?php
}

function cyberrakshak_guard_chatbot_shortcode($atts, $content = null) {
  $settings = get_option(CYBERRAKSHAK_GUARD_OPTION, []);
  $badge = (($settings['show_badge'] ?? '') === '1') ? '<div class="cyberrakshak-guard-badge">Protected by CyberRakshak Guard</div>' : '';
  return '<div class="cyberrakshak-guard-chatbot">' . do_shortcode($content ?? '') . $badge . '</div>';
}

add_shortcode('cyberrakshak_chatbot_guard', 'cyberrakshak_guard_chatbot_shortcode');
add_shortcode('cyberrakshak_guard_chatbot', 'cyberrakshak_guard_chatbot_shortcode');

function cyberrakshak_guard_input($message, $metadata = []) {
  return cyberrakshak_guard_request('/api/guard/input', [
    'message' => $message,
    'metadata' => $metadata,
  ]);
}

function cyberrakshak_guard_output($response, $metadata = []) {
  return cyberrakshak_guard_request('/api/guard/output', [
    'aiResponse' => $response,
    'metadata' => $metadata,
  ]);
}

function cyberrakshak_guard_request($path, $body) {
  $settings = get_option(CYBERRAKSHAK_GUARD_OPTION, []);
  $base_url = rtrim($settings['api_base_url'] ?? '', '/');
  $api_key = $settings['api_key'] ?? '';
  if (!$base_url || !$api_key) {
    return new WP_Error('cyberrakshak_guard_config', 'CyberRakshak Guard API URL and API key are required.');
  }
  $response = wp_remote_post($base_url . $path, [
    'timeout' => 12,
    'headers' => [
      'Content-Type' => 'application/json',
      'x-api-key' => $api_key,
    ],
    'body' => wp_json_encode($body),
  ]);
  if (is_wp_error($response)) {
    return $response;
  }
  $data = json_decode(wp_remote_retrieve_body($response), true);
  if (wp_remote_retrieve_response_code($response) >= 400) {
    return new WP_Error('cyberrakshak_guard_api', $data['message'] ?? 'CyberRakshak Guard request failed.');
  }
  return $data;
}

add_action('wp_ajax_cyberrakshak_guard_test_connection', function () {
  check_ajax_referer('cyberrakshak_guard_test', 'nonce');
  if (!current_user_can('manage_options')) {
    wp_send_json_error(['message' => 'Forbidden'], 403);
  }
  $result = cyberrakshak_guard_input('Hello from WordPress admin test.', ['source' => 'wordpress-admin']);
  if (is_wp_error($result)) {
    wp_send_json_error(['message' => $result->get_error_message()], 400);
  }
  wp_send_json_success(['action' => $result['action'] ?? 'UNKNOWN']);
});
