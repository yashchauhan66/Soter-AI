<?php
/**
 * Shortcode for CyberRakshak Guard.
 *
 * @package CyberRakshak_Guard
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Provides the [cyberrakshak_chatbot_guard] shortcode. It renders a small
 * client widget that proxies messages through the WordPress REST routes (never
 * calling the Guard API or exposing the API key directly). It also renders an
 * optional security badge. No secret is ever printed to the page.
 */
class CyberRakshak_Shortcode {

	/**
	 * Singleton instance.
	 *
	 * @var CyberRakshak_Shortcode|null
	 */
	private static $instance = null;

	/**
	 * Get instance.
	 *
	 * @return CyberRakshak_Shortcode
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
		add_shortcode( 'cyberrakshak_chatbot_guard', array( $this, 'render' ) );
		add_shortcode( 'cyberrakshak_security_badge', array( $this, 'render_badge' ) );
	}

	/**
	 * Render the guard helper widget. This exposes the local REST URLs and a
	 * REST nonce so a chatbot can guard messages client-side via the WP proxy.
	 *
	 * @param array $atts Shortcode attributes.
	 * @return string
	 */
	public function render( $atts ) {
		$atts = shortcode_atts(
			array(
				'show_badge' => 'true',
			),
			$atts,
			'cyberrakshak_chatbot_guard'
		);

		$config = array(
			'inputUrl'  => esc_url_raw( rest_url( 'cyberrakshak/v1/guard-input' ) ),
			'outputUrl' => esc_url_raw( rest_url( 'cyberrakshak/v1/guard-output' ) ),
			'nonce'     => wp_create_nonce( 'wp_rest' ),
		);

		ob_start();
		?>
		<div class="cyberrakshak-guard-widget" data-cyberrakshak-guard="1">
			<script type="application/json" class="cyberrakshak-guard-config">
				<?php echo wp_json_encode( $config ); ?>
			</script>
			<?php if ( 'true' === $atts['show_badge'] ) : ?>
				<?php echo $this->badge_markup(); // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- markup pre-escaped. ?>
			<?php endif; ?>
		</div>
		<?php
		return (string) ob_get_clean();
	}

	/**
	 * Render only the security badge.
	 *
	 * @return string
	 */
	public function render_badge() {
		return $this->badge_markup();
	}

	/**
	 * Build the security badge markup. Contains no secret.
	 *
	 * @return string
	 */
	private function badge_markup() {
		$label   = esc_html__( 'Protected by CyberRakshak Guard', 'cyberrakshak-guard' );
		$tooltip = esc_attr__( 'OWASP LLM Top 10 aligned. Reduces risk; does not guarantee complete protection.', 'cyberrakshak-guard' );
		return sprintf(
			'<span class="cyberrakshak-guard-badge" title="%1$s">%2$s</span>',
			$tooltip,
			$label
		);
	}
}
