function Firefeed(baseURL, newContext) {
  var self = this;
  this._name = null;
  this._userid = null;
  this._firebase = null;
  this._mainUser = null;
  this._fullName = null;
  this._searchHandler = null;
  this._currentSearch = null;

  // Every time we call firebaseRef.on, we need to remember to call .off,
  // when requested by the caller via unload(). We'll store our handlers
  // here so we can clear them later.
  this._handlers = [];

  if (!baseURL || typeof baseURL != "string") {
    throw new Error("Invalid baseURL provided");
  }
  this._firebase = new Firebase(
    baseURL, newContext || false ? new Firebase.Context() : null
  );

  this._authHandlers = [];
  this._firebaseAuthClient = new FirebaseSimpleLogin(this._firebase, function(error, user) {
    self._onLoginStateChange(error, user);
  });
}

Firefeed.prototype._onLoginStateChange = function(error, user) {
    var self = this;
    if (error) {
      // An error occurred while authenticating the user.
      this.handleLogout();
    } else if (user) {
      // The user is successfully logged in.
      this.onLogin(user);
    } else {
      // No existing session found - the user is logged out.
      //this.onLogout();
    }
  };
  
  Firefeed.prototype._getPicURL= function(id, large) {
    return "https://graph.facebook.com/" + (id || this._userid) +
           "/picture/?type=" + (large ? "large" : "square") +
           "&return_ssl_resources=1";
  };

Firefeed.prototype.onLoginStateChange = function(onLoginStateChange) {
  var self = this;
  this._authHandlers.push(onLoginStateChange);
};


Firefeed.prototype.onLogin = function(user) {
  var self = this;
  this._userid = user.id;

  // Populate search index
  var firstNameKey = [user['first_name'], user['last_name'], user['id']].join('|').toLowerCase();
  var lastNameKey = [user['last_name'], user['first_name'], user['id']].join('|').toLowerCase();
  this._firebase.child('search/firstName').child(firstNameKey).set(user['id']);
  this._firebase.child('search/lastName').child(lastNameKey).set(user['id']);

  this._mainUser = self._firebase.child("users").child(self._userid);
  this._fullName = user.name;
  this._name = user.first_name;

  var peopleRef = self._firebase.child("people").child(self._userid);
  peopleRef.once("value", function(peopleSnap) {
    var info = {};
    var val = peopleSnap.val();
    if (!val) {
      // If this is a first time login, upload user details.
      info = {
        name: self._name, fullName: self._fullName,
        location: "", bio: "", pic: self._getPicURL()
      };
      peopleRef.set(info);
    } else {
      info = val;
    }
    peopleRef.child("presence").set("online");
    info.id = self._userid;
    self._user = info;

    // Notify downstream listeners for new authenticated user state
    for (var i = 0; i < self._authHandlers.length; i++) {
      self._authHandlers[i](null, self._user);
    }
  });
}

Firefeed.prototype.login = function(provider) {
  this._firebaseAuthClient.login(provider, {
    'rememberMe': true
  });
};

Firefeed.prototype.getUserInfo = function(user, onComplete,
                                          onFollower, onFollowersComplete,
                                          onFollowee, onFolloweesComplete) {
  var self = this;
  self._validateCallback(onComplete, true);

  var ref = self._firebase.child("people").child(user);
  var handler = ref.on("value", function(snap) {
    var val = snap.val();
    val.pic = self._getPicURL(snap.name(), true);
    val.bio = val.bio.substr(0, 141);
    val.location = val.location.substr(0, 80);
    onComplete(val);
  });
  self._handlers.push({
    ref: ref, handler: handler, eventType: "value"
  });

  var userRef = self._firebase.child('users').child(user);
  var followerRef = userRef.child('followers');
  var followerHandle = followerRef.on('child_added', function(snapshot) {
    self._firebase.child('people').child(snapshot.name()).once('value', function(snap) {
      var userInfo = snap.val();
      userInfo['userId'] = snapshot.name();
      if (onFollower) onFollower(userInfo);
    });
  });
  self._handlers.push({
    ref: followerRef, handle: followerHandle, eventType: 'child_added'
  });
  followerRef.once('value', function(snap) {
    if (onFollowersComplete) onFollowersComplete();
  });

  var followeeRef = userRef.child('following');
  var followeeHandle = followeeRef.on('child_added', function(snapshot) {
    self._firebase.child('people').child(snapshot.name()).once('value', function(snap) {
      var userInfo = snap.val();
      userInfo['userId'] = snapshot.name();
      if (onFollowee) onFollowee(userInfo);
    });
  });
  self._handlers.push({
    ref: followeeRef, handle: followeeHandle, eventType: 'child_added'
  });
  followeeRef.once('value', function(snap) {
    if (onFolloweesComplete) onFolloweesComplete();
  });
};