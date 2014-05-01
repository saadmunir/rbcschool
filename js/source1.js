
var __ff_ui;
$(function() {
  __ff_ui = new RBCSchoolUI();
});

function RBCSchoolUI() {
	console.log('temp');
  this.limit = 141;
  this.loggedIn = false;
  this.firefeed = new Firefeed("https://rbcschool.firebaseIO.com/");
  this.unload = null;

  var loginButton = $("#login-button");
  loginButton.click(function(e) {
    e.preventDefault();
    self.firefeed.login('facebook');
  });
  
  
  
  login = function(provider) {
  this._firebaseAuthClient.login(provider, {
    'rememberMe': true
  });
  
    this._firebaseAuthClient = new FirebaseSimpleLogin(this._firebase, function(error, user) {
    self._onLoginStateChange(error, user);
  });


}