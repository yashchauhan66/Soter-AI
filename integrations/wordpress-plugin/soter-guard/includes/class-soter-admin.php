<?php
/**
 * Admin settings page for SoterAI Guard.
 *
 * @package Soter_Guard
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Renders the Settings > SoterAI Guard page and handles the AJAX test
 * connection action. All actions require manage_options and nonce verification.
 */
class Soter_Admin {

	/**
	 * Singleton instance.
	 *
	 * @var Soter_Admin|null
	 */
	private static $instance = null;

	/**
	 * Get instance.
	 *
	 * @return Soter_Admin
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
		add_action( 'admin_menu', array( $this, 'add_menu' ) );
		add_action( 'admin_enqueue_scripts', array( $this, 'enqueue' ) );
		add_action( 'wp_ajax_soter_test_connection', array( $this, 'ajax_test_connection' ) );
	}

	/**
	 * Register the settings page under Settings.
	 *
	 * @return void
	 */
	public function add_menu() {
		add_options_page(
			__( 'SoterAI Guard', 'soter-guard' ),
			__( 'SoterAI Guard', 'soter-guard' ),
			'manage_options',
			'soter-guard',
			array( $this, 'render_page' )
		);
	}

	/**
	 * Enqueue admin assets only on our settings page.
	 *
	 * @param string $hook Current admin page hook.
	 * @return void
	 */
	public function enqueue( $hook ) {
		if ( 'settings_page_soter-guard' !== $hook ) {
			return;
		}
		wp_enqueue_style( 'soter-guard-admin', SOTER_GUARD_URL . 'assets/admin.css', array(), SOTER_GUARD_VERSION );
		wp_enqueue_script( 'soter-guard-admin', SOTER_GUARD_URL . 'assets/admin.js', array( 'jquery' ), SOTER_GUARD_VERSION, true );
		wp_localize_script(
			'soter-guard-admin',
			'SoterAIGuard',
			array(
				'ajaxUrl' => admin_url( 'admin-ajax.php' ),
				'nonce'   => wp_create_nonce( 'soter_test_connection' ),
				'testing' => __( 'Testing…', 'soter-guard' ),
				'test'    => __( 'Test connection', 'soter-guard' ),
			)
		);
	}

	/**
	 * Render the settings page. The API key is shown only as a masked field.
	 *
	 * @return void
	 */
	public function render_page() {
		if ( ! current_user_can( 'manage_options' ) ) {
			wp_die( esc_html__( 'You do not have permission to access this page.', 'soter-guard' ) );
		}
		$settings = Soter_Settings::get();
		$has_key  = ! empty( $settings['api_key'] );
		?>
		<div class="wrap soter-guard-wrap">
			<h1><?php esc_html_e( 'SoterAI Guard', 'soter-guard' ); ?></h1>
			<p class="description">
				<?php esc_html_e( 'OWASP LLM Top 10 aligned AI security gateway. Reduces risk through detect, block, redact, monitor, and report. Does not guarantee complete protection.', 'soter-guard' ); ?>
			</p>
			<form action="options.php" method="post">
				<?php settings_fields( 'soter_guard_group' ); ?>
				<table class="form-table" role="presentation">
					<tr>
						<th scope="row"><label for="crg_base_url"><?php esc_html_e( 'API Base URL', 'soter-guard' ); ?></label></th>
						<td><input name="<?php echo esc_attr( SOTER_GUARD_OPTION ); ?>[base_url]" id="crg_base_url" type="url" class="regular-text" value="<?php echo esc_attr( $settings['base_url'] ); ?>" placeholder="https://api.soterai.publicvm.com" /></td>
					</tr>
					<tr>
						<th scope="row"><label for="crg_api_key"><?php esc_html_e( 'API Key', 'soter-guard' ); ?></label></th>
						<td>
							<input name="<?php echo esc_attr( SOTER_GUARD_OPTION ); ?>[api_key]" id="crg_api_key" type="password" autocomplete="off" class="regular-text" value="<?php echo $has_key ? '************' : ''; ?>" placeholder="ck_live_…" />
							<p class="description"><?php esc_html_e( 'Stored server-side only. Never exposed to site visitors. Leave the masked value to keep the existing key.', 'soter-guard' ); ?></p>
						</td>
					</tr>
					<tr>
						<th scope="row"><label for="crg_project_id"><?php esc_html_e( 'Project ID', 'soter-guard' ); ?></label></th>
						<td><input name="<?php echo esc_attr( SOTER_GUARD_OPTION ); ?>[project_id]" id="crg_project_id" type="text" class="regular-text" value="<?php echo esc_attr( $settings['project_id'] ); ?>" /></td>
					</tr>
					<tr>
						<th scope="row"><?php esc_html_e( 'Guards', 'soter-guard' ); ?></th>
						<td>
							<label><input type="checkbox" name="<?php echo esc_attr( SOTER_GUARD_OPTION ); ?>[enable_input]" value="1" <?php checked( $settings['enable_input'], 1 ); ?> /> <?php esc_html_e( 'Enable Input Guard', 'soter-guard' ); ?></label><br />
							<label><input type="checkbox" name="<?php echo esc_attr( SOTER_GUARD_OPTION ); ?>[enable_output]" value="1" <?php checked( $settings['enable_output'], 1 ); ?> /> <?php esc_html_e( 'Enable Output Guard', 'soter-guard' ); ?></label><br />
							<label><input type="checkbox" name="<?php echo esc_attr( SOTER_GUARD_OPTION ); ?>[enable_badge]" value="1" <?php checked( $settings['enable_badge'], 1 ); ?> /> <?php esc_html_e( 'Enable Security Badge', 'soter-guard' ); ?></label>
						</td>
					</tr>
					<tr>
						<th scope="row"><label for="crg_block_message"><?php esc_html_e( 'Block message', 'soter-guard' ); ?></label></th>
						<td><input name="<?php echo esc_attr( SOTER_GUARD_OPTION ); ?>[block_message]" id="crg_block_message" type="text" class="regular-text" value="<?php echo esc_attr( $settings['block_message'] ); ?>" /></td>
					</tr>
					<tr>
						<th scope="row"><label for="crg_rate_limit"><?php esc_html_e( 'Public rate limit (per minute / IP)', 'soter-guard' ); ?></label></th>
						<td><input name="<?php echo esc_attr( SOTER_GUARD_OPTION ); ?>[rate_limit]" id="crg_rate_limit" type="number" min="1" max="240" value="<?php echo esc_attr( $settings['rate_limit'] ); ?>" /></td>
					</tr>
				</table>
				<?php submit_button(); ?>
			</form>
			<hr />
			<h2><?php esc_html_e( 'Test connection', 'soter-guard' ); ?></h2>
			<p><button type="button" class="button button-secondary" id="crg-test-connection"><?php esc_html_e( 'Test connection', 'soter-guard' ); ?></button> <span id="crg-test-result" class="crg-test-result"></span></p>
		</div>
		<?php
	}

	/**
	 * AJAX handler for the test connection button.
	 *
	 * @return void
	 */
	public function ajax_test_connection() {
		if ( ! current_user_can( 'manage_options' ) ) {
			wp_send_json_error( array( 'message' => __( 'Permission denied.', 'soter-guard' ) ), 403 );
		}
		check_ajax_referer( 'soter_test_connection', 'nonce' );

		$client = new Soter_Client();
		$result = $client->test_connection();
		if ( ! empty( $result['ok'] ) ) {
			wp_send_json_success( array( 'message' => $result['message'] ) );
		}
		wp_send_json_error( array( 'message' => $result['message'] ) );
	}
}
