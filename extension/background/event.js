var event = {};

event.onMessage = function(request, sender, callback) {
	if (request.action in event.messageHandlers) {

		if(!sender.hasOwnProperty('tab') || sender.tab.id < 1) {
			sender.tab = {};
			sender.tab.id = page.currentTabId;
		}
		console.log("onMessage(" + request.action + ") for #" + sender.tab.id);

		event.invoke(event.messageHandlers[request.action], callback, sender.tab.id, request.args);

		// onMessage closes channel for callback automatically
		// if this method does not return true
		if(callback) {
			return true;
		}
	}
}

/**
 * Get interesting information about the given tab.
 * Function adapted from AdBlock-Plus.
 *
 * @param {function} handler to call after invoke
 * @param {function} callback to call after handler or null
 * @param {integer} senderTabId
 * @param {array} args
 * @param {bool} secondTime
 * @returns null (asynchronous)
 */
event.invoke = function(handler, callback, senderTabId, args, secondTime) {
	if(senderTabId < 1) {
		return;
	}

	if(!page.tabs[senderTabId]) {
		page.createTabEntry(senderTabId);
	}

	// remove information from no longer existing tabs
	page.removePageInformationFromNotExistingTabs();

	chrome.tabs.get(senderTabId, function(tab) {
        if (chrome.runtime.lastError) {
            console.log('failed to invoke function for tab: '+chrome.runtime.lastError);
            return;
        }

	//chrome.tabs.query({"active": true, "windowId": chrome.windows.WINDOW_ID_CURRENT}, function(tabs) {
		//if (tabs.length === 0)
		//	return; // For example: only the background devtools or a popup are opened
		//var tab = tabs[0];

		if(!tab) {
			return;
		}

		if (!tab.url) {
			// Issue 6877: tab URL is not set directly after you opened a window
			// using window.open()
			if (!secondTime) {
				window.setTimeout(function() {
					event.invoke(handler, callback, senderTabId, args, true);
				}, 250);
			}
			return;
		}

		if(!page.tabs[tab.id]) {
			page.createTabEntry(tab.id);
		}

		args = args || [];

		args.unshift(tab);
		args.unshift(callback);

		if(handler) {
			handler.apply(this, args);
		}
		else {
			console.log("undefined handler for tab " + tab.id);
		}
	});
}


event.onShowAlert = function(callback, tab, message) {
	alert(message);
}

event.onLoadSettings = function(callback, tab) {
	page.settings = (typeof(localStorage.settings) == 'undefined') ? {} : JSON.parse(localStorage.settings);
    mooltipass.loadSettings();
    //console.log('onLoadSettings: page.settings = ', page.settings);
}

event.onLoadKeyRing = function(callback, tab) {
    console.log('event.onLoadKeyRing()');
}

event.onGetSettings = function(callback, tab) {
	event.onLoadSettings();
	callback({ data: page.settings });
}

event.onSaveSettings = function(callback, tab, settings) {
	localStorage.settings = JSON.stringify(settings);
	event.onLoadSettings();
}

event.onGetStatus = function(callback, tab) {
    console.log('event.onGetStatus()');

	browserAction.showDefault(null, tab);
    page.tabs[tab.id].errorMessage = undefined;  // XXX debug

	callback({
		identifier: 'my_mp_key',
		configured: true,
		databaseClosed: false,
		keePassHttpAvailable: true,
		encryptionKeyUnrecognized: false,
		associated: mooltipass.isConnected(),
		error: page.tabs[tab.id].errorMessage
	});
}

event.onPopStack = function(callback, tab) {
	browserAction.stackPop(tab.id);
	browserAction.show(null, tab);
}

event.onGetTabInformation = function(callback, tab) {
	var id = tab.id || page.currentTabId;

	callback(page.tabs[id]);
}

event.onGetConnectedDatabase = function(callback, tab) {
    console.log('event.onGetConnectedDatabase()');
	callback({
		"count": 10,
		"identifier": 'my_mp_db_id'
	});
}

event.onGetKeePassHttpVersions = function(callback, tab) {
    console.log('event.onGetKeePassHttpVersions()');
	callback({"current": '0.1', "latest": '0.1'});
}

event.onGetMooltipassVersions = function(callback, tab) {
	var resp ={ 'currentFirmware': mooltipass.getFirmwareVersion(),
               'latestFirmware': '0.5',
	           'currentClient': mooltipass.getClientVersion(),
               'latestClient': mooltipass.latestClient.version, 
	           'currentChromeipass': mooltipass.currentChromeipass.version,
               'latestChromeipass': mooltipass.latestChromeipass.version};
    console.log('versions:',resp);
	callback(resp);
}

event.onCheckUpdateKeePassHttp = function(callback, tab) {
    console.log('event.onCheckUpdateKeePassHttp()');
    mooltipass.getLatestChromeipassVersion();
    console.log('currentChromeipass '+mooltipass.currentChromeipass.version+', latestChromeipass '+mooltipass.latestChromeipass.version);
	callback({"current": mooltipass.currentKeePassHttp.version, "latest": mooltipass.latestKeePassHttp.version});
}

event.onChromeipassUpdateAvailable = function(callback, tab) {
    console.log('event.onChromeipassUpdateAvailable()');
    mooltipass.getLatestChromeipassVersion();
    console.log('currentChromeipass '+mooltipass.currentChromeipass.version+', latestChromeipass '+mooltipass.latestChromeipass.version);
	return (mooltipass.currentChromeipass.versionParsed > 0 && mooltipass.currentChromeipass.versionParsed < mooltipass.latestChromeipass.versionParsed);
}

event.onClientUpdateAvailable = function(callback, tab) {
    mooltipass.getLatestClientVersion();
    mooltipass.getClientVersion();
    console.log('currentClient '+mooltipass.currentClient.version+', latestClient '+mooltipass.latestClient.version);
	return (mooltipass.currentClient.versionParsed > 0 && mooltipass.currentClient.versionParsed < mooltipass.latestClient.versionParsed);
}

event.onRemoveCredentialsFromTabInformation = function(callback, tab) {
	var id = tab.id || page.currentTabId;

	page.clearCredentials(id);
}

event.onNotifyButtonClick = function(id, buttonIndex) {
    console.log('notification',id,'button',buttonIndex,'clicked');
	// Check notification type
	if(event.mpUpdate[id].type == "singledomainadd")
	{
		// Adding a single domain notification
		if (buttonIndex == 0) 
		{
			// Blacklist
			console.log('notification blacklist ',event.mpUpdate[id].url);
			mooltipass.blacklistUrl(event.mpUpdate[id].url);
		} 
		else 
		{
		}
	}
    delete event.mpUpdate[id];
}

event.onNotifyClosed = function(id) {
    delete event.mpUpdate[id];
}

chrome.notifications.onButtonClicked.addListener(event.onNotifyButtonClick);
chrome.notifications.onClosed.addListener(event.onNotifyClosed);

event.notificationCount = 0;
event.mpUpdate = {};

event.onUpdateNotify = function(callback, tab, username, password, url, usernameExists, credentialsList) {
	
	// Here we should detect a subdomain!
	if(true)
	{
		// Single domain
		// Here we should send a request to the mooltipass to know if the username exists!
		if(true)
		{
			// Unknown user
			if (mooltipass.isBlacklisted(url)) 
			{
				console.log('notify: ignoring blacklisted url',url);
				return;
			}

			event.notificationCount++;

			var noteId = 'mpUpdate.'+event.notificationCount.toString();

			event.mpUpdate[noteId] = { tab: tab, username: username, password: password, url: url, type: "singledomainadd" };
			
			mooltipass.updateCredentials(null, tab, 0, username, password, url);

			chrome.notifications.create(noteId,
					{   type: 'basic',
						title: 'Credentials Detected!',
						message: 'Please Approve their Storage on the Mooltipass',
						iconUrl: '/icons/mooltipass-128.png',
						buttons: [ {title: 'Black list this website', iconUrl: '/icons/forbidden-icon.png'}] },
						function(id) 
						{
							console.log('notification created for',id);
						});
		}
		else
		{}
	}
	else
	{}
}

event.onUpdate = function(callback, tab, username, password, url, usernameExists, credentialsList) {
    mooltipass.updateCredentials(callback, tab, 0, username, password, url);
}

event.onLoginPopup = function(callback, tab, logins) {
	var stackData = {
		level: 1,
		iconType: "questionmark",
		popup: "popup_login.html"
	}
	browserAction.stackUnshift(stackData, tab.id);

	page.tabs[tab.id].loginList = logins;

	browserAction.show(null, tab);
}

event.onHTTPAuthPopup = function(callback, tab, data) {
	var stackData = {
		level: 1,
		iconType: "questionmark",
		popup: "popup_httpauth.html"
	}
	browserAction.stackUnshift(stackData, tab.id);

	page.tabs[tab.id].loginList = data;

	browserAction.show(null, tab);
}

event.onMultipleFieldsPopup = function(callback, tab) {
	var stackData = {
		level: 1,
		iconType: "normal",
		popup: "popup_multiple-fields.html"
	}
	browserAction.stackUnshift(stackData, tab.id);

	browserAction.show(null, tab);
}


// all methods named in this object have to be declared BEFORE this!
event.messageHandlers = {
	'update': event.onUpdate,
	'add_credentials': mooltipass.addCredentials,
	'blacklistUrl': mooltipass.blacklistUrl,
	'alert': event.onShowAlert,
	'associate': mooltipass.associate,
	'check_update_keepasshttp': event.onCheckUpdateKeePassHttp,
	'get_connected_database': event.onGetConnectedDatabase,
	'get_keepasshttp_versions': event.onGetKeePassHttpVersions,
	'get_mooltipass_versions': event.onGetMooltipassVersions,
	'get_settings': event.onGetSettings,
	'get_status': event.onGetStatus,
	'get_tab_information': event.onGetTabInformation,
	'load_keyring': event.onLoadKeyRing,
	'load_settings': event.onLoadSettings,
	'pop_stack': event.onPopStack,
	'popup_login': event.onLoginPopup,
	'popup_multiple-fields': event.onMultipleFieldsPopup,
	'remove_credentials_from_tab_information': event.onRemoveCredentialsFromTabInformation,
	'retrieve_credentials': mooltipass.retrieveCredentials,
	'show_default_browseraction': browserAction.showDefault,
	'update_credentials': mooltipass.updateCredentials,
	'save_settings': event.onSaveSettings,
	'update_notify': event.onUpdateNotify,
	'stack_add': browserAction.stackAdd,
	'update_available_chromeipass': event.onChromeipassUpdateAvailable,
	'update_available_client': event.onClientUpdateAvailable,
	'generate_password': mooltipass.generatePassword,
	'copy_password': mooltipass.copyPassword
};
