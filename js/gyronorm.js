/**
* JavaScript project for accessing and normalizing the accelerometer and gyroscope data on mobile devices
*
* @author Doruk Eker <dorukeker@gmail.com>
* @copyright 2014 Doruk Eker <http://dorukeker.com>
* @version 0.0.1
* @license MIT License | http://opensource.org/licenses/MIT 
*/

/*-------------------------------------------------------*/
/* PULBIC VARIABLES */

var gn = new Object();


/*-------------------------------------------------------*/
/* PRIVATE VARIABLES */

var gn_interval = null;					// Timer to return values
var gn_isCalibrating = false;			// Flag if calibrating
var gn_calibrationValues = new Array();	// Array to store values when calculating alpha offset 
var gn_calibrationValue = 0;			// Alpha offset value
var gn_gravityCoefficient = 0;			// Coefficient to normalze gravity related values
var gn_isready = false;					// Flag if event listeners are added

gn.log = null;						// Function to callback on error. There is no default value. It can only be set by the user on gn.init()

/* OPTIONS */
gn._frequency 				= 50;		// Frequency for the return data in milliseconds
gn._gravityNormalized		= true;		// Flag if to normalize gravity values
gn._directionAbsolute	= false;	// Flag if to return absolute or relative alpha values
gn._decimalCount			= 2;		// Number of digits after the decimals point for the return values

gn._values = {
	do:{
		alpha:0,
		beta:0,
		gamma:0,
		absolute:false
	},
	dm:{
		x:0,
		y:0,
		z:0,
		gx:0,
		gy:0,
		gz:0,
		alpha:0,
		beta:0,
		gamma:0
	}
}

/*-------------------------------------------------------*/
/* PUBLIC FUNCTIONS */

/*
*
* Initialize the object
* 
* @param object options - values are as follows. If set in the init function they overwrite the default option values 
* @param int options.frequency
* @param boolean options.gravityNormalized
* @param boolean options.directionAbsolute
*
*/
gn.init = function(options){

	// Assign options that are passed with the init function
	if(options && options.frequency) gn._frequency = options.frequency;
	if(options && options.gravityNormalized) gn._gravityNormalized = options.gravityNormalized;
	if(options && options.directionAbsolute) gn._directionAbsolute = options.directionAbsolute;
	if(options && options.decimalCount) gn._decimalCount = options.decimalCount;

	try{
		calibrate();
		gn_setupListeners();
	} catch(err){
		onError(err);
	}

	gn_isready = true;
}


/*
*
* Stops all the tracking and listening on the window objects
*
*/
gn.end = function(){
	try{
		gn.stop();
		window.removeEventListener('deviceorientation',onDeviceOrientationHandler);
		window.removeEventListener('devicemotion',onDeviceMotionHandler);
		window.removeEventListener('compassneedscalibration',onCompassNeedsCalibrationHandler);
		gn_isready = false;
	} catch(err){
		onError(err);
	}
}

/*
*
* Starts tracking the values
* 
* @param function callback - Callback function to read the values
*
*/
gn.start = function(callback){
	if(!gn_isready){
		onError({message:'GyroNorm is not initialized. First call gn.init()' , code:1});
		return;
	}
	calibrate();
	gn_interval = setInterval(function(){
		callback(snapShot());	
	},gn._frequency);
}

/*
*
* Stops tracking the values
*
*/
gn.stop = function(){
	if(gn_interval){
		clearInterval(gn_interval);
	}
}

/*
*
* Toggles if to normalize gravity related values
* 
* @param boolean flag
*
*/
gn.normalizeGravity = function(flag){
	gn._gravityNormalized = (flag)?true:false;
}


/*
*
* Toggles if to give absolute orientation values
* 
* @param boolean flag
*
*/
gn.giveAbsoluteDirection = function(flag){
	gn._directionAbsolute = (flag)?true:false;
}

/*
*
* Sets the current alpha value as "0"
*
*/
gn.setHeadDirection = function(){
	gn._directionAbsolute = false;
	calibrate();
}

/*-------------------------------------------------------*/
/* PRIVATE FUNCTIONS */

/*
*
* Starts listening to the eventa on the window object
*
*/
function gn_setupListeners(){
	window.addEventListener('deviceorientation',onDeviceOrientationHandler,true);
	window.addEventListener('devicemotion',onDeviceMotionHandler,true);
	window.addEventListener('compassneedscalibration',onCompassNeedsCalibrationHandler,true);
}

/*
*
* Gets called only in calibration mode. Gets the mean value of the alpha deviations. And stores it as calibration.
*
*/
function updateCalibration(){
	if(gn_calibrationValues.length > 19){
		gn_calibrationValues.splice(0,5);
		var total = 0;
		for(var i = 0 ; i < gn_calibrationValues.length ; i++){
			total += gn_calibrationValues[i];
		}
		gn_calibrationValue = parseInt(total / 15);
		gn_isCalibrating = false;
	}
}

/*
*
* Handler for device orientation event
*
*/
function onDeviceOrientationHandler(event){
	// Check if values are returned correctly
	if(!event.alpha && !event.beta && !event.gamma){
		onError({message:'Device orientation event values are not returned as expected.' , code:2 });
		window.removeEventListener('deviceorientation',onDeviceOrientationHandler);
	}

	// For the first 20 values add the alpha to calibration list
	if(gn_isCalibrating){
		gn_calibrationValues.push(event.alpha);
		updateCalibration();
		return;
	}

	// Assign event values to the object values
	gn._values.do.alpha = event.alpha;
	gn._values.do.beta = event.beta;
	gn._values.do.gamma = event.gamma;
	gn._values.do.absolute = event.absolute;
}

/*
*
* Handler for device motion event
*
*/
function onDeviceMotionHandler(event){

	// Assign gravity coefficient. Assumes that the user is holding the phot up right facing the screen.
	// If you cannot make this assumption because of the usecase, disable the normalization via changing the option 'gravityNormalized' value to false
	if(gn_gravityCoefficient == 0){
		gn_gravityCoefficient = (event.accelerationIncludingGravity.z < 0)?1:-1;
		return;
	}

	// Assign event values to the object values
	gn._values.dm.x = event.acceleration.x;
	gn._values.dm.y = event.acceleration.y;
	gn._values.dm.z = event.acceleration.z;

	gn._values.dm.gx = event.accelerationIncludingGravity.x;
	gn._values.dm.gy = event.accelerationIncludingGravity.y;
	gn._values.dm.gz = event.accelerationIncludingGravity.z;	

	gn._values.dm.alpha = event.rotationRate.alpha;
	gn._values.dm.beta = event.rotationRate.beta;
	gn._values.dm.gamma = event.rotationRate.gamma;
}

/*
*
* Handler for device motion event
*
*/
function onCompassNeedsCalibrationHandler(event){

	onError({message:'Compass is not calibrated.' , code:3});

}

/*
*
* Utility function to round with digits after the decimal point
*
* @param float number - the original number to round
*
*/
function rnd(number){
	return Math.round(number * Math.pow(10 , gn._decimalCount)) / Math.pow(10 , gn._decimalCount);
}

/*
*
* Starts calibration
*
*/
function calibrate(){
	gn_isCalibrating = true;
	gn_calibrationValues = new Array();
}


/*
*
* Takes a snapshot of the values
*
*/
function snapShot(){

	// Send absolute or relative alpha. Default is relative.
	var alphaToSend = 0;
	if(!gn._directionAbsolute){
		alphaToSend = gn._values.do.alpha - gn_calibrationValue;
		alphaToSend = (alphaToSend < 0)?(360 - Math.abs(alphaToSend)):alphaToSend;
	} else {
		alphaToSend = gn._values.do.alpha;
	}

	var snapShot = {
		do:{
			alpha:rnd(alphaToSend),
			beta:rnd(gn._values.do.beta),
			gamma:rnd(gn._values.do.gamma),
			absolute:gn._values.do.absolute
		},
		dm:{
			x:rnd(gn._values.dm.x),
			y:rnd(gn._values.dm.y),
			z:rnd(gn._values.dm.z),
			gx:rnd(gn._values.dm.gx),
			gy:rnd(gn._values.dm.gy),
			gz:rnd(gn._values.dm.gz),
			alpha:rnd(gn._values.dm.alpha),
			beta:rnd(gn._values.dm.beta),
			gamma:rnd(gn._values.dm.gamma)
		}
	};

	// Normalize gravity
	if(gn._gravityNormalized){
		snapShot.dm.gx *= gn_gravityCoefficient;
		snapShot.dm.gy *= gn_gravityCoefficient;
		snapShot.dm.gz *= gn_gravityCoefficient;
	}	

	return snapShot;
}


/*
*
* Starts listening to orientation event on the window object
*
*/
function onError(err){
	if(gn.log){
		if(typeof(err) == 'string'){
			err = {message:err , code:0}
		}
		gn.log(err);
	}
}
