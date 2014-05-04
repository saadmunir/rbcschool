var __ff_ui;
$(function() {
	__ff_ui = new RBCFeedUI();
});

function RBCFeedUI() {
	this._limit = 141;
	this._loggedIn = false;
	this._spinner = new Spinner();
	this._rbcfeed = new RBCFeed("https://rbcschool.firebaseIO.com/");
	this._unload = null;

	// Setup page navigation.
	this._setupHandlers();

	// Setup History listener.
	var self = this;
	window.History.Adapter.bind(window, "statechange", function() {
		self._pageController(window.History.getState().hash, false);
	});

	self._rbcfeed.onLoginStateChange(function(error, user) {
		self.onLoginStateChange(error, user);
	});

}

RBCFeedUI.prototype._setupHandlers = function() {
	var self = this;
	$(document).on("click", "a.profile-link", function(e) {
		e.preventDefault();
		self._go($(this).attr("href"));
	});
	$(document).on("click", "a.spark-link", function(e) {
		e.preventDefault();
		self._go($(this).attr("href"));
	});
	$(document).on("click", "#logout-button", function(e) {
		e.preventDefault();
		self.logout();
	});
};

RBCFeedUI.prototype._go = function(url) {
	window.History.pushState(null, null, url);
};

RBCFeedUI.prototype._pageController = function(url) {
	// Extract sub page from URL, if any.
	var idx = url.indexOf("?");
	var hash = (idx > 0) ? url.slice(idx + 1) : "";
	var value = hash.split("=");

	this._unload && this._unload();

	switch (value[0]) {
		case "profile":
			if (!value[1]) {
				this._unload = this.render404();
			} else {
				this._unload = this.renderProfile(value[1]);
			}
			break;
		case "spark":
			if (!value[1]) {
				this._unload = this.render404();
			} else {
				this._unload = this.renderSpark(value[1]);
			}
			break;
		case "search":
			this._unload = this.renderSearch();
			break;
		default:
			if (this._loggedIn) {
				this._unload = this.renderTimeline(this._loggedIn);
			} else {
				this._unload = this.renderHome();
			}
			break;
	}
};

RBCFeedUI.prototype._postHandler = function(e) {
	var sparkText = $("#spark-input");
	var sparkButton = $("#spark-button");
	var containerEl = $("#spark-button-div");
	var message = $("<div>").addClass("msg").html("Posting...");

	var self = this;
	e.preventDefault();
	sparkButton.replaceWith(message);
	self._spinner.spin(containerEl.get(0));
	self._rbcfeed.post(sparkText.val(), function(err, done) {
		if (!err) {
			message.html("Posted!");
			sparkText.val("");
		} else {
			message.html("Posting failed!");
		}
		$("#c-count").val(self._limit);
		message.css("visibility", "visible");
	});
};

RBCFeedUI.prototype._handleNewSpark = function(listId, limit, func) {
	var self = this;
	func(limit, function(sparkId, spark) {
		spark.content = spark.content.substring(0, self._limit);
		spark.sparkId = sparkId;
		spark.friendlyTimestamp = self._formatDate(new Date(spark.timestamp || 0));
		var sparkEl = $(Mustache.to_html($("#tmpl-spark").html(), spark)).hide();
		$("#" + listId).prepend(sparkEl);
		sparkEl.slideDown("slow");
	}, function(sparkId) {
		setTimeout(function() {
			$("#spark-" + sparkId).stop().slideToggle("slow", function() {
				$(this).remove();
			});
		}, 100);
	});
};

RBCFeedUI.prototype._formatDate = function(date) {
	var localeDate = date.toLocaleString();
	// Remove GMT offset if it's there.
	var gmtIndex = localeDate.indexOf(' GMT');
	if (gmtIndex > 0) {
		localeDate = localeDate.substr(0, gmtIndex);
	}
	return localeDate;
};

RBCFeedUI.prototype._editableHandler = function(id, value) {
	if (id == "inputLocation") {
		this._rbcfeed.setProfileField("location", value);
	}
	if (id == "inputBio") {
		this._rbcfeed.setProfileField("bio", value);
	}
	return true;
};

RBCFeedUI.prototype.onLoginStateChange = function(error, info) {
	this._loggedIn = info;
	$("#header").html(Mustache.to_html($("#tmpl-page-header").html(), {
		user : this._loggedIn
	}));
	if (info) {
		this.renderTimeline(info);
	} else {
		this.renderHome();
	}
};

RBCFeedUI.prototype.logout = function(e) {
	if (e) {
		e.preventDefault();
	}
	this._rbcfeed.logout();
	this._loggedIn = false;
	this.renderHome();
};

RBCFeedUI.prototype.render404 = function() {
	// TODO: Add 404 page.
	this.renderHome();
};

RBCFeedUI.prototype.goHome = function() {
	this._go("/");
};

RBCFeedUI.prototype.renderHome = function(e) {
	if (e) {
		e.preventDefault();
	}
	if (this._loggedIn) {
		return this.renderTimeline(this._loggedIn);
	}

	$("#header").html($("#tmpl-index-header").html());



	var body = Mustache.to_html($("#tmpl-content").html(), {
		classes : "cf home",
		content : $("#tmpl-index-content").html()
	});
	$("#body").html(body);

	var self = this;

	var loginButton = $("#login-button");
	loginButton.click(function(e) {
		var emailID = document.getElementById("emailID");
		var passwordID = document.getElementById("passwordID");
		e.preventDefault();
		self._rbcfeed.login('password', emailID.value, passwordID.value);
		console.log(emailID.value);
	});

	var createAccountButton = $("#createaccount-button");
	createAccountButton.click(function(e) {
		var emailID = document.getElementById("emailID");
		var passwordID = document.getElementById("passwordID");
		var firstNameData = document.getElementById("firstNameID");
		var lastnameData = document.getElementById("lastNameID");
		var bioData = document.getElementById("bioID");
		var locationData = document.getElementById("locationID");
		
		e.preventDefault();
		self._rbcfeed.createAccount('password', emailID.value, passwordID.value, firstNameData.value, lastnameData.value, bioData.value, locationData.value);
		console.log(emailID.value);
	});

	// Attach handler to display the latest 5 sparks.
	self._handleNewSpark("spark-index-list", 5, self._rbcfeed.onLatestSpark.bind(self._rbcfeed));
	return function() {
		self._rbcfeed.unload();
	};
};

RBCFeedUI.prototype.renderTimeline = function(info) {
	var self = this;
	$("#header").html(Mustache.to_html($("#tmpl-page-header").html(), {
		user : self._loggedIn
	}));

	// Render placeholders for location / bio if not filled in.
	info.location = info.location.substr(0, 80);
	info.bio = info.bio.substr(0, 141);

	// Render body.
	var content = Mustache.to_html($("#tmpl-timeline-content").html(), info);
	var body = Mustache.to_html($("#tmpl-content").html(), {
		classes : "cf",
		content : content
	});
	$("#body").html(body);

/**	// Attach textarea handlers.
	var charCount = $("#c-count");
	var sparkText = $("#spark-input");
	function _textAreaHandler() {
		var text = sparkText.val();
		charCount.text("" + (self._limit - text.length));
		if (text.length > self._limit) {
			charCount.css("color", "#FF6347");
			$("#spark-button").css("visibility", "hidden");
		} else if (text.length == 0) {
			$("#spark-button").css("visibility", "hidden");
		} else {
			charCount.css("color", "#999");
			$("#spark-button").css("visibility", "visible");
		}
	}


	charCount.text(self._limit);
	sparkText.keyup(_textAreaHandler);
	sparkText.blur(_textAreaHandler);
**/
	// Attach post spark button.
	$("#spark-button").click(self._postHandler.bind(self));

	// Attach new spark event handler, capped to 10 for now.
	self._handleNewSpark("spark-timeline-list", 10, self._rbcfeed.onNewSpark.bind(self._rbcfeed));

	// Get some "suggested" users.
	/*
	self._rbcfeed.getSuggestedUsers(function(userid, info) {
		info.id = userid;
		$(Mustache.to_html($("#tmpl-suggested-user").html(), info)).appendTo("#suggested-users");
		var button = $("#followBtn-" + userid);
		// Fade out the suggested user if they were followed successfully.
		button.click(function(e) {
			e.preventDefault();
			button.remove();
			self._rbcfeed.follow(userid, function(err, done) {
				// TODO FIXME: Check for errors!
				$("#followBox-" + userid).fadeOut(1500);
			});
		});
	});

	// Make profile fields editable.
	$(".editable").editable(function(value, settings) {
		self._editableHandler($(this).attr("id"), value);
		return value;
	});*/
	return function() {
		self._rbcfeed.unload();
	};
};

RBCFeedUI.prototype.renderProfile = function(uid) {
	var self = this;
	$("#header").html(Mustache.to_html($("#tmpl-page-header").html(), {
		user : self._loggedIn
	}));

	// Render profile page body.
	$("#body").html(Mustache.to_html($("#tmpl-profile-body").html()));

	var followersLoaded = false;
	var followers = [];
	var renderFollowers = function() {
		$('#follower-profile-list').html(Mustache.to_html($('#tmpl-user-list').html(), {
			users : followers
		}));
	};

	var followeesLoaded = false;
	var followees = [];
	var renderFollowees = function() {
		$('#followee-profile-list').html(Mustache.to_html($('#tmpl-user-list').html(), {
			users : followees
		}));
	};

	// Update user info.
	self._rbcfeed.getUserInfo(uid, function(info) {
		info.id = uid;
		var content = Mustache.to_html($("#tmpl-profile-content").html(), info);
		$("#profile-content").html(content);
		var button = $("#followBtn-" + info.id);

		// Show follow button if logged in.
		if (self._loggedIn && self._loggedIn.id != info.id) {
			button.click(function(e) {
				e.preventDefault();
				self._rbcfeed.follow(info.id, function(err, done) {
					// TODO FIXME: Check for errors!
					$("#followBtn-" + info.id).fadeOut(1500);
				});
			});
		} else {
			button.hide();
		}
	}, /*onFollower=*/
	function(newFollower) {
		followers.push(newFollower);
		if (followersLoaded) {
			renderFollowers();
		}
	}, /*onFollowersComplete=*/
	function() {
		followersLoaded = true;
		renderFollowers();
	}, /*onFollowee=*/
	function(newFollowee) {
		followees.push(newFollowee);
		if (followeesLoaded) {
			renderFollowees();
		}
	}, /*onFolloweesComplete=*/
	function() {
		followeesLoaded = true;
		renderFollowees();
	});

	// Render this user's tweets. Capped to 5 for now.
	self._handleNewSpark("spark-profile-list", 5, self._rbcfeed.onNewSparkFor.bind(self._rbcfeed, uid));
	return function() {
		self._rbcfeed.unload();
	};
};

RBCFeedUI.prototype.renderSpark = function(id) {
	var self = this;
	$("#header").html(Mustache.to_html($("#tmpl-page-header").html(), {
		user : self._loggedIn
	}));

	// Render spark page body.
	self._rbcfeed.getSpark(id, function(spark) {
		if (spark !== null && spark.author) {
			self._rbcfeed.getUserInfo(spark.author, function(authorInfo) {
				for (var key in authorInfo) {
					spark[key] = authorInfo[key];
				}
				spark.content = spark.content.substring(0, self._limit);
				spark.friendlyTimestamp = self._formatDate(new Date(spark.timestamp || 0));
				var content = Mustache.to_html($("#tmpl-spark-content").html(), spark);
				var body = Mustache.to_html($("#tmpl-content").html(), {
					classes : "cf",
					content : content
				});
				$("#body").html(body);
			});
		}
	});
	return function() {
		self._rbcfeed.unload();
	};
}; 