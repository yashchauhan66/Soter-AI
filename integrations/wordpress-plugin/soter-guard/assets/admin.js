/* global jQuery, SoterAIGuard */
( function ( $ ) {
	'use strict';

	$( function () {
		const button = $( '#crg-test-connection' );
		const result = $( '#crg-test-result' );

		button.on( 'click', function () {
			button.prop( 'disabled', true ).text( SoterAIGuard.testing );
			result.removeClass( 'crg-ok crg-error' ).text( '' );

			$.post( SoterAIGuard.ajaxUrl, {
				action: 'soter_test_connection',
				nonce: SoterAIGuard.nonce
			} )
				.done( function ( response ) {
					if ( response && response.success ) {
						result.addClass( 'crg-ok' ).text( response.data.message );
					} else {
						const message = response && response.data ? response.data.message : 'Connection failed.';
						result.addClass( 'crg-error' ).text( message );
					}
				} )
				.fail( function ( xhr ) {
					let message = 'Connection failed.';
					if ( xhr && xhr.responseJSON && xhr.responseJSON.data ) {
						message = xhr.responseJSON.data.message;
					}
					result.addClass( 'crg-error' ).text( message );
				} )
				.always( function () {
					button.prop( 'disabled', false ).text( SoterAIGuard.test );
				} );
		} );
	} );
}( jQuery ) );
