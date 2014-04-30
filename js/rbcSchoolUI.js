
var __ff_ui;
$(function() {
  __ff_ui = new RBCSchoolUI();
});

function RBCSchoolUI() {
	console.log('temp');
  this._limit = 141;
  this._loggedIn = false;
  this._firefeed = new Firefeed("https://rbcschool.firebaseIO.com/");
  this._unload = null;

  // Setup page navigation.
  this._setupHandlers();

  // Setup History listener.
  var self = this;
  window.History.Adapter.bind(window, "statechange", function() {
    self._pageController(window.History.getState().hash, false);
  });

  self._firefeed.onLoginStateChange(function(error, user) {
  	console.log('TESTIIIIIIIIIIIIINGGGGGGGGGGGg');
    self.onLoginStateChange(error, user);
  });
  
  var loginButton = $("#login-button");
  loginButton.click(function(e) {
  	console.log('TES');
    e.preventDefault();
    self._firefeed.login('facebook');
  });
}

RBCSchoolUI.prototype._setupHandlers = function() {
  var self = this;
  $(document).on("click", "a.profile-link", function(e) {
    e.preventDefault();
    self._go($(this).attr("href"));
  });
  $(document).on("click", "a.spark-link", function(e) {
    e.preventDefault();
    self._go($(this).attr("href"));
  });
  $(document).on("click", "#top-logo", function(e) {
    e.preventDefault();
    self._go("/");
  });
  $(document).on("click", "#logout-button", function(e) {
    e.preventDefault();
    self.logout();
  });
};

RBCSchoolUI.prototype._postHandler = function(e) {
  var sparkText = $("#spark-input");
  var sparkButton = $("#spark-button");
  var containerEl = $("#spark-button-div");
  var message = $("<div>").addClass("msg").html("Posting...");

  var self = this;
  e.preventDefault();
  sparkButton.replaceWith(message);
  self._spinner.spin(containerEl.get(0));
  self._firefeed.post(sparkText.val(), function(err, done) {
    if (!err) {
      message.html("Posted!").css("background", "#008000");
      sparkText.val("");
    } else {
      message.html("Posting failed!").css("background", "#FF6347");
    }
    self._spinner.stop();
    $("#c-count").val(self._limit);
    message.css("visibility", "visible");
    message.fadeOut(1500, function() {
      message.replaceWith(sparkButton);
      sparkButton.click(self._postHandler.bind(self));
    });
  });
};

RBCSchoolUI.prototype._handleNewSpark = function(listId, limit, func) {
  var self = this;
  func(
    limit,
    function(sparkId, spark) {
      spark.content = spark.content.substring(0, self._limit);
      spark.sparkId = sparkId;
      spark.friendlyTimestamp = self._formatDate(
        new Date(spark.timestamp || 0)
      );
      var sparkEl = $(Mustache.to_html($("#tmpl-spark").html(), spark)).hide();
      $("#" + listId).prepend(sparkEl);
      sparkEl.slideDown("slow");
    }, function(sparkId) {
      setTimeout(function() {
        $("#spark-" + sparkId).stop().slideToggle("slow", function() {
          $(this).remove();
        });
      }, 100);
    }
  );
};

RBCSchoolUI.prototype.onLoginStateChange = function(error, info) {
  this._loggedIn = info;
  console.log('11111111111111111');
  $("#header").html(Mustache.to_html($("#tmpl-page-header").html(), {user: this._loggedIn}));
  if (info) {
  	console.log('222222222222222');
    this.renderTimeline(info);
  } else {
  	console.log('33333333333333');
    this.renderHome();
  }
};

RBCSchoolUI.prototype.logout = function(e) {
  if (e) {
    e.preventDefault();
  }
  this._firefeed.logout();
  this._loggedIn = false;
  this.renderHome();
};

RBCSchoolUI.prototype.renderTimeline = function(info) {
  console.log('**************************');
  var self = this;
  $("#header").html(Mustache.to_html($("#tmpl-page-header").html(), {user: self._loggedIn}));

  // Render placeholders for location / bio if not filled in.
  info.location = info.location.substr(0, 80) || "Your Location...";
  info.bio = info.bio.substr(0, 141) || "Your Bio...";

  // Render body.
  var content = Mustache.to_html($("#tmpl-timeline-content").html(), info);
  var body = Mustache.to_html($("#tmpl-content").html(), {
    classes: "cf", content: content
  });
  $("#body").html(body);
 
  console.log('*************((((((((((((((((((()))))))))))))))))))*************');
  
  
  charCount.text(self._limit);
  sparkText.keyup(_textAreaHandler);
  sparkText.blur(_textAreaHandler);

  // Attach post spark button.
  $("#spark-button").click(self._postHandler.bind(self));

  // Attach new spark event handler, capped to 10 for now.
  self._handleNewSpark(
    "spark-timeline-list", 10,
    self._firefeed.onNewSpark.bind(self._firefeed)
  );

  // Get some "suggested" users.
  self._firefeed.getSuggestedUsers(function(userid, info) {
    info.id = userid;
    $(Mustache.to_html($("#tmpl-suggested-user").html(), info)).
      appendTo("#suggested-users");
    var button = $("#followBtn-" + userid);
    // Fade out the suggested user if they were followed successfully.
    button.click(function(e) {
      e.preventDefault();
      button.remove();
      self._firefeed.follow(userid, function(err, done) {
        // TODO FIXME: Check for errors!
        $("#followBox-" + userid).fadeOut(1500);
      });
    });
  });
};

RBCSchoolUI.prototype.renderProfile = function(uid) {
  var self = this;
  $("#header").html(Mustache.to_html($("#tmpl-page-header").html(), {user: self._loggedIn}));

  // Render profile page body.
  $("#body").html(Mustache.to_html($("#tmpl-profile-body").html()));

  var followersLoaded = false;
  var followers = [];
  var renderFollowers = function() {
    $('#follower-profile-list').html(Mustache.to_html($('#tmpl-user-list').html(), {users: followers}));
  };

  var followeesLoaded = false;
  var followees = [];
  var renderFollowees = function() {
    $('#followee-profile-list').html(Mustache.to_html($('#tmpl-user-list').html(), {users: followees}));
  };

  // Update user info.
  self._firefeed.getUserInfo(uid, function(info) {
    info.id = uid;
    var content = Mustache.to_html($("#tmpl-profile-content").html(), info);
    $("#profile-content").html(content);
    var button = $("#followBtn-" + info.id);

    // Show follow button if logged in.
    if (self._loggedIn && self._loggedIn.id != info.id) {
      button.click(function(e) {
        e.preventDefault();
        self._firefeed.follow(info.id, function(err, done) {
          // TODO FIXME: Check for errors!
          $("#followBtn-" + info.id).fadeOut(1500);
        });
      });
    } else {
      button.hide();
    }
  }, /*onFollower=*/ function(newFollower) {
    followers.push(newFollower);
    if (followersLoaded) {
      renderFollowers();
    }
  }, /*onFollowersComplete=*/ function() {
    followersLoaded = true;
    renderFollowers();
  }, /*onFollowee=*/ function(newFollowee) {
    followees.push(newFollowee);
    if (followeesLoaded) {
      renderFollowees();
    }
  }, /*onFolloweesComplete=*/ function() {
    followeesLoaded = true;
    renderFollowees();
  });

  // Render this user's tweets. Capped to 5 for now.
  self._handleNewSpark(
    "spark-profile-list", 5,
    self._firefeed.onNewSparkFor.bind(self._firefeed, uid)
  );
  return function() { self._firefeed.unload(); };
};