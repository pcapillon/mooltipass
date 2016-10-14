/*
/ Form Detection by combinations.
/ Searches the DOM for a predefined set of combinations and retrieves credentials or prepares everything to be saved
/ This will, eventually, replace cip.* 
*/

/* Debug Levels:

0: No debug info
1: Important Messages
2: Informational Messages
3: Available
4: Verbose Debug messages
5: Show every function call
6: Special case, show "check_for_new_input_fields" as well

*/

function mcCombinations() {}

mcCombinations.prototype = ( function() {
	return {
		constructor:mcCombinations,
		inputQueryPattern: "input[type='text'], input[type='email'], input[type='password'], input[type='tel'], input[type='number'], input:not([type])",
		forms: {
			noform: { fields: [] }
		},
		uniqueNumber: 342845638,
		settings: {
			debugLevel: 0,
			postDetectionFeature: true
		}
    };
})();

/*
* Init the mcCombinations procedure.
* This should be called just once per body/frame!
*/
mcCombinations.prototype.init = function( callback ) {
	if (this.settings.debugLevel > 4) cipDebug.log('%c mcCombinations: %c Init','background-color: #c3c6b4','color: #333333');
	chrome.runtime.sendMessage({
		"action": "get_settings",
	}, function(response) {
		if (this.settings.debugLevel > 3) cipDebug.log('%c mcCombinations: %c Got settings', 'background-color: #c3c6b4','color: #FF0000',response);
		if ( typeof(response) !== 'undefined') {
			mpJQ.extend(this.settings, response.data);
			if (this.settings.debugLevel > 0) cipDebug.warn('mcCombinations: Status is: ', this.settings.status);

			if ( callback ) callback();
			if (this.settings.status.unlocked) this.detectCombination();
		} else {
			if (this.settings.debugLevel > 0) cipDebug.warn('Get settings returned empty!', runtime.lastError);
		}
	}.bind(this));
};

/*
* Array containing all the possible combinations we support
*/
mcCombinations.prototype.possibleCombinations = [
	{
		// Seen at icloud.com, seems to comform to an Apple's proprietary identity management system (IDMS)
		combinationId: 'canFieldBased',
		combinationName: 'Login Form with can-field properties',
		requiredFields: [
			{
				selector: 'input[can-field=accountName]',
				submitPropertyName: 'can-field',
				mapsTo: 'username'
			},
			{
				selector: 'input[can-field=password]',
				submitPropertyName: 'can-field',
				mapsTo: 'password'	
			}
		],
		scorePerMatch: 50,
		score: 0,
		maxfields: 3
	},
	{
		combinationId: 'loginform001',
		combinationName: 'Simple Login Form with Email',
		requiredFields: [
			{
				selector: 'input[type=email]',
				mapsTo: 'username'
			},
			{
				selector: 'input[type=password]',
				mapsTo: 'password'
			},
		],
		scorePerMatch: 50,
		score: 0,
		autoSubmit: true,
		maxfields: 3,
		extraFunction: function( fields ) {
			/* This function will be called if the combination is found, in this case: enable any disabled field in the form */
			if ( fields[0].closest ) fields[0].closest('form').find('input:disabled').prop('disabled',false);
		}
	},
	{
		combinationId: 'loginform002',
		combinationName: 'Simple Login Form with Text',
		requiredFields: [
			{
				selector: 'input[type=text],input:not([type])',
				mapsTo: 'username'
			},
			{
				selector: 'input[type=password]',
				mapsTo: 'password'
			},
		],
		scorePerMatch: 50,
		score: 0,
		autoSubmit: true,
		maxfields: 4,
		extraFunction: function( fields ) {
			/* This function will be called if the combination is found, in this case: enable any disabled field in the form */
			if ( fields[0].closest ) fields[0].closest('form').find('input:disabled').prop('disabled',false);
		}
	},
	{
		combinationId: 'passwordreset001',
		combinationName: 'Password Reset without Confirmation',
		requiredFields: [
			{
				selector: 'input[type=password]:visible',
				mapsTo: 'password'
			},
			{
				selector: 'input[type=password]:visible',
				mapsTo: 'password'
			},
		],
		scorePerMatch: 50,
		score: 0,
		autoSubmit: false
	},
	{
		combinationId: 'passwordreset002',
		combinationName: 'Password Reset with Confirmation',
		requiredFields: [
			{
				selector: 'input[type=password]',
				mapsTo: 'password'
			},
			{
				selector: 'input[type=password]'
			},
			{
				selector: 'input[type=password]'
			},
		],
		scorePerMatch: 25,
		score: 0,
		autoSubmit: false
	},
	{
		combinationId: 'enterpassword',
		combinationName: 'A password fill-in form',
		requiredFields: [
			{
				selector: 'input[type=password]',
				mapsTo: 'password'
			}
		],
		scorePerMatch: 100,
		score: 0,
		autoSubmit: true
	}
];

/*
* The main function for mcCombinations.
* Searches for input fields in the DOM and matches them against a combination of our own
*/
mcCombinations.prototype.detectCombination = function() {
	if (this.settings.debugLevel > 4) cipDebug.log('%c mcCombinations: %c detectCombination','background-color: #c3c6b4','color: #333333');
	var numberOfFields = this.getAllForms();
	if (this.settings.debugLevel > 1) cipDebug.log('detectCombination has found ' + numberOfFields + ' fields.');

	if ( numberOfFields > 0 ) {
		this.detectForms();	

		for( form in this.forms ) {
			currentForm = this.forms[ form ];

			// Unsure about this restriction. Probably should always make a retrieve credentials call (need to think about it)
			if ( currentForm.combination ) {
				var url = document.location.origin;
				var submitUrl = currentForm.element?this.getFormActionUrl( currentForm.element ):url;
				
				if (this.settings.debugLevel > 1) cipDebug.log('%c mcCombinations - %c Retrieving credentials', 'background-color: #c3c6b4','color: #777777', currentForm.element );
				chrome.runtime.sendMessage({
					'action': 'retrieve_credentials',
					'args': [ url, submitUrl, true, true]
				}, $.proxy(this.retrieveCredentialsCallback,this));
			}
		}
	}
}

/*
* Returns the action URL for a form
*/
mcCombinations.prototype.getFormActionUrl = function( formElement ) {
	if (this.settings.debugLevel > 4) cipDebug.log('%c mcCombinations: %c getFormActionUrl','background-color: #c3c6b4','color: #333333');
	var action = formElement[0].action;

	if(typeof(action) != "string" || action == "" || action.indexOf('{') > -1) {
		action = document.location.origin + document.location.pathname;
	}

	if (this.settings.debugLevel > 3) cipDebug.log('%c mcCombinations - %c Form Action URL','background-color: #c3c6b4','color: #777777', action);
	return action;
}

/*
* Match found fields with available combinations
* Set debug to 4 to see all the traversing
*/
mcCombinations.prototype.detectForms = function() {
	if (this.settings.debugLevel > 4) cipDebug.log('%c mcCombinations: %c detectTypeofForm','background-color: #c3c6b4','color: #333333');
	
	// Traverse Forms
	for( form in this.forms ) {
		currentForm = this.forms[ form ];
		if (this.settings.debugLevel > 3) cipDebug.log('%c mcCombinations - Form Detection: %c Traversing forms ','background-color: #c3c6b4','color: #777777', currentForm);
		if ( currentForm.fields.length == 0 ) continue; // Form has no fields.

		// Check combination against current form
		this.possibleCombinations.some( function( combination_data, index ) {
			if (this.settings.debugLevel > 3) cipDebug.log('\t %c mcCombinations  - Form Detection: %c Checking combination ' + combination_data.combinationName,'background-color: #c3c6b4','color: #777777; font-weight: bold;');
			if ( combination_data.maxfields && combination_data.maxfields < currentForm.fields.length ) {
				if (this.settings.debugLevel > 3) cipDebug.log('\t %c mcCombinations  - Form Detection: %c Form has more fields than expected ', 'background-color: #c3c6b4','color: #777777;');
				return false; // Form has more fields than expected
			}
			if ( combination_data.requiredFields.length > currentForm.fields.length) return false; // Form has less fields than required by this combination

			// Assign the combination to the form
			currentForm.combination = mpJQ.extend( true, {}, combination_data);

			// Traverse fields in form and match against combination
			var matching = currentForm.fields.some( function( field ) {
				if (this.settings.debugLevel > 3) cipDebug.log('\t\t %c mcCombinations - Form Detection: %c Checking field ','background-color: #c3c6b4','color: #777777', field.prop('type') );
				var matching = currentForm.combination.requiredFields.some( function( requiredField ) {
					if ( requiredField.found ) return false;
					if ( field.is( requiredField.selector ) ) {
						requiredField.found = true;
						currentForm.combination.score += currentForm.combination.scorePerMatch;
						if (this.settings.debugLevel > 3) cipDebug.log('\t\t\t %c mcCombinations - Form Detection: %c Field Match! Combination Score set to ','background-color: #c3c6b4','color: #777777', currentForm.combination.score );

						// Map fields into the combination.
						if ( requiredField.mapsTo ) {
							if (!currentForm.combination.savedFields) currentForm.combination.savedFields = {};
							currentForm.combination.savedFields[ requiredField.mapsTo ] = {
								value: '',
								submitPropertyName: requiredField.submitPropertyName
							};

							if (!currentForm.combination.fields) currentForm.combination.fields = {};
							currentForm.combination.fields[ requiredField.mapsTo ] = field;
							requiredField.mapsTo = null;
						}

						// Check current score
						if ( currentForm.combination.score == 100 ) {
							this.waitingForPost = true;
							if (this.settings.debugLevel > 3) cipDebug.log('\t\t\t %c mcCombinations - Form Detection: %c Combination Match!','background-color: #c3c6b4','color: #800000', currentForm.combination.combinationName );
							return true;
						}
						return false;
					}
				}.bind(this));
				return matching;
			}.bind(this));
			return matching;
		}.bind(this));

		if ( currentForm.combination.score < 100 ) {
			currentForm.combination = false;
			cipDebug.log('\t\t\t %c mcCombinations - Form Detection: %c No viable combination found!','background-color: #c3c6b4','color: #800000');
		}
	}
	return;
}

/*
* Get all Fields on the DOM and store them in fields variable.
* Returns the number of fields found
*/
mcCombinations.prototype.getAllForms = function() {
	if (this.settings.debugLevel > 4) cipDebug.log('%c mcCombinations: %c getAllForms','background-color: #c3c6b4','color: #333333');
	var found = 0;

	for ( form in this.forms ) {
		this.forms[form].fields = [];
	}
	

	// get all input fields which are text, email or password and visible
	mpJQ( this.inputQueryPattern ).each( function( index, field ) {
		field = mpJQ( field );

		// Ignore our field(s)
		if( field.attr('id') == 'mooltipass-password-generator') {
			return;
		}
		
		// Check for field availability
		if( this.isAvailableField( field ) ) {
			found++;
			if (this.settings.debugLevel > 3) cipDebug.log('%c mcCombinations: %c Available Field ', 'background-color: #c3c6b4','color: #00FF00', field[0]);
			this.setUniqueId( field );

			// Store fields in FORMS
			containerForm = field.closest('form');
			if ( containerForm.length == 0 ) var currentForm = this.forms.noform; // Field isn't in a Form
			else {
				if ( !containerForm.data('mp-id') ) {
					this.setUniqueId( containerForm );
					this.forms[ containerForm.data('mp-id') ] = {
						fields: [],
						element: containerForm
					};
					containerForm.submit( $.proxy(this.onSubmit,this) );
				}
				var currentForm = this.forms[ containerForm.data('mp-id') ];
			}

			currentForm.fields.push( field );
		} else {
			if (this.settings.debugLevel > 3) cipDebug.log('%c mcCombinations: %c Unavailable Field ', 'background-color: #c3c6b4','color: #FF0000', field[0]);
		}
	}.bind(this));

	return found;
};

/*
* Intercept form submit
*/
mcCombinations.prototype.onSubmit = function( event ) {
	if (this.settings.debugLevel > 4) cipDebug.log('%c mcCombinations: %c onSubmit','background-color: #c3c6b4','color: #333333');
	this.waitingForPost = false;

	// Check if there's a difference between what we retrieved and what is being submitted
	var currentForm = this.forms[ $(event.target).data('mp-id') ];

	var storedUsernameValue = currentForm.combination.savedFields.username?currentForm.combination.savedFields.username.value:'';
	var storedPasswordValue = currentForm.combination.savedFields.password?currentForm.combination.savedFields.password.value:'';

	var submittedUsernameValue = currentForm.combination.fields.username.val();
	var submittedPasswordValue = currentForm.combination.fields.password.val();

	if ( storedUsernameValue != submittedUsernameValue || storedPasswordValue != submittedPasswordValue ) { // Only save when they differ
		cip.rememberCredentials( event, 'unused', submittedUsernameValue, 'unused', submittedPasswordValue);
	}
}



/*
* Check if a field is visible and ready to get input
* $field: The field selector as a JQUERY reference obj
* Returns true is the field appears to be available and visible
*/
mcCombinations.prototype.isAvailableField = function($field) {
	if (this.settings.debugLevel > 4) cipDebug.log('%c mcCombinations: %c isAvailableField','background-color: #c3c6b4','color: #333333');
	return (
		$field.is(":visible")
		&& $field.css("visibility") != "hidden"
		&& !$field.is(':disabled')
		&& $field.css("visibility") != "collapsed"
		&& $field.css("visibility") != "collapsed"
	);
}

/*
* Sets an unique ID for an element (field or form)
*/
mcCombinations.prototype.setUniqueId = function( element ) {
	if (this.settings.debugLevel > 4) cipDebug.log('%c mcCombinations: %c setUniqueId','background-color: #c3c6b4','color: #333333');
	if(element && !element.attr("data-mp-id")) {
		var elementId = element.attr("id");
		if( elementId ) {
			element.attr("data-mp-id", elementId);
			return;
		} else {
			// create own ID if no ID is set for this field
			this.uniqueNumber += 1;
			element.attr( "data-mp-id", "mpJQ" + String( this.uniqueNumber ) );
		}
	}
}

/*
* Parses the credentials obtained
*/
mcCombinations.prototype.retrieveCredentialsCallback = function (credentials, dontAutoFillIn) {
	if (this.settings.debugLevel > 4) cipDebug.log('%c mcCombinations: %c retrieveCredentialsCallback','background-color: #c3c6b4','color: #333333');

	if (!credentials || credentials.length < 1) {
		if (this.settings.debugLevel > 1) cipDebug.log('%c mcCombinations: %c retrieveCredentialsCallback returned empty','background-color: #c3c6b4','color: #FF0000');
		return;
	}

	if (this.settings.debugLevel > 1) cipDebug.log('%c mcCombinations - %c retrieveCredentialsCallback filling form','background-color: #c3c6b4','color: #FF0000');
	for( form in this.forms ) {
		currentForm = this.forms[ form ];
		if ( !currentForm.combination || !currentForm.combination.fields ) continue;

		// Unsure about this restriction. Probably should always make a retrieve credentials call (need to think about it)
		if ( currentForm.combination ) {
			if ( credentials[0].Login && currentForm.combination.fields.username ) {
				if (this.settings.debugLevel > 3) cipDebug.log('%c mcCombinations - %c retrieveCredentialsCallback filling form - Username','background-color: #c3c6b4','color: #FF0000');
				// Fill-in Username
				currentForm.combination.fields.username.val('');
				currentForm.combination.fields.username.sendkeys( credentials[0].Login );
				currentForm.combination.fields.username[0].dispatchEvent(new Event('change'));
				currentForm.combination.savedFields.username.value = credentials[0].Login;	
			}
			
			if ( credentials[0].Password && currentForm.combination.fields.password ) {
				if (this.settings.debugLevel > 3) cipDebug.log('%c mcCombinations - %c retrieveCredentialsCallback filling form - Password','background-color: #c3c6b4','color: #FF0000');
				// Fill-in Password
				currentForm.combination.fields.password.val('');
				currentForm.combination.fields.password.sendkeys( credentials[0].Password );
				currentForm.combination.fields.password[0].dispatchEvent(new Event('change'));
				currentForm.combination.savedFields.password.value = credentials[0].Password;	
			}

			this.doSubmit( currentForm );
			return;
		}
	}
}

/*
* Submits the form!
*/
mcCombinations.prototype.doSubmit = function doSubmit( currentForm ) {
	if (this.settings.debugLevel > 4) cipDebug.log('%c mcCombinations: %c doSubmit','background-color: #c3c6b4','color: #333333');
    
    if ( currentForm.element ) {
    	// Try to click the submit element
	    var submitButton = currentForm.element.find(':submit');
	    if ( submitButton.length > 0 ) { 
	    	// Add timeout to allow form check procedures to run
	    	setTimeout( function() {
	    		submitButton[0].click();
	    	},100);
	    } else if (formElement.element ) {
	    	// If no submit button is found, just submit the form
	    	formElement.submit();
	    }
    } else { // There is no FORM element. Click stuff around
		setTimeout( function() {
        	mpJQ('#sign-in, .btn-submit').click();
        },1500);
    }
}

/*
* When a POST request is detected, we check it in case there's our info
*/
mcCombinations.prototype.postDetected = function( details ) {
	if (this.settings.debugLevel > 4) cipDebug.log('%c mcCombinations: %c postDetected','background-color: #c3c6b4','color: #333333');
	// Just act if we're waiting for a post
	if ( this.waitingForPost && this.settings.postDetectionFeature) {
		// Loop throught the forms and check if we've got a match
		for( form in this.forms ) {
			currentForm = this.forms[ form ];
			if ( currentForm.combination ) {
				currentCombination = currentForm.combination;

				// Use the right field attribute
				var attrUsername = 'name';
				var attrPassword = 'name';
				if ( currentCombination.savedFields.username.submitPropertyName ) {
					attrUsername = currentCombination.savedFields.username.submitPropertyName;
				}

				if ( currentCombination.savedFields.password.submitPropertyName ) {
					var attrPassword = currentCombination.savedFields.password.submitPropertyName;	
				}

				if ( details.requestBody ) { // Form sent FORM DATA
					var usernameValue = details.requestBody.formData[ currentCombination.fields.username.attr( attrUsername ) ];
					var passwordValue = details.requestBody.formData[ currentCombination.fields.password.attr( attrPassword ) ];
				} else { // Client sent a RAW request.
					var usernameValue = details[ currentCombination.fields.username.attr( attrUsername ) ];
					var passwordValue = details[ currentCombination.fields.password.attr( attrPassword ) ];
				}

				var storedUsernameValue = currentCombination.savedFields.username.value;
				var storedPasswordValue = currentCombination.savedFields.password.value;

				if (this.settings.debugLevel > 3) {
					cipDebug.log('%c mcCombinations: %c postDetected - Stored: ', 'background-color: #c3c6b4','color: #333333', storedUsernameValue, storedPasswordValue);
					cipDebug.log('%c mcCombinations: %c postDetected - Received: ','background-color: #c3c6b4','color: #333333', usernameValue, passwordValue);
				}

				// Only update if they differ from our database values (and if new values are filled in)
				if ( storedUsernameValue != usernameValue || storedPasswordValue != passwordValue && (usernameValue != '' && passwordValue != '') ) {
					var url = document.location.origin;
					chrome.runtime.sendMessage({
						'action': 'update_notify',
						'args': [usernameValue, passwordValue, url]
					});
				}
			}
		}
		return;
	}
}