/* global jQuery, CyberRakshakGuard */
( function ( $ ) {
	'use strict';

	$( function () {
		var button = $( '#crg-test-connection' );
		var result = $( '#crg-test-result' );

		button.on( 'click', function () {
			button.prop( 'disabled', true ).text( CyberRakshakGuard.testing );
			result.removeClass( 'crg-ok crg-error' ).text( '' );

			$.post( CyberRakshakGuard.ajaxUrl, {
				action: 'cyberrakshak_test_connection',
				nonce: CyberRakshakGuard.nonce
			} )
				.done( function ( response ) {
					if ( response && response.success ) {
						result.addClass( 'crg-ok' ).text( response.data.message );
					} else {
						var message = response && response.data ? response.data.message : 'Connection failed.';
						result.addClass( 'crg-error' ).text( message );
					}
				} )
				.fail( function ( xhr ) {
					var message = 'Connection failed.';
					if ( xhr && xhr.responseJSON && xhr.responseJSON.data ) {
						message = xhr.responseJSON.data.message;
					}
					result.addClass( 'crg-error' ).text( message );
				} )
				.always( function () {
					button.prop( 'disabled', false ).text( CyberRakshakGuard.test );
				} );
		} );
	} );
}( jQuery ) );
