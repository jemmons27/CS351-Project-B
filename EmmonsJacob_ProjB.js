//Questions: Browser Size changing somewhat changes the field of view, but for the most part things are scaled correctly. Is this correct behavior?
//Mouse drag rotation with quaternions - Not entirely sure what the intended behavior should be vs what I have
//How to fix orthographic view cutoff when moving across field
// Vertex shader program:
var VSHADER_SOURCE =
 `attribute vec4 a_Position;
  attribute vec4 a_Color;
  uniform mat4 u_MvpMatrix;
  varying vec4 v_Color;
  void main() {
    gl_Position = u_MvpMatrix * a_Position;
    v_Color = a_Color;
  }`;

// Fragment shader program
var FSHADER_SOURCE =
 `#ifdef GL_ES
  precision mediump float;
  #endif
  varying vec4 v_Color;
  void main() {
    gl_FragColor = v_Color;
  }`;

//Global vars (so we can call draw() and other fcns without arguments)
//==============================================================================
// (later: organize these in one (or a few) global JS object...

var gl;                 // WebGL rendering context
var g_canvas = document.getElementById('webgl');  // Retrieve HTML <canvas> element
var g_mvpMatrix = new Matrix4();  // model-view-projection matrix (for 3D camera view)
var g_mvpMatrixLoc;     // GPU location for the u_mvpMatrix uniform var
var g_vertCount = 0;    // # of vertices to draw
var g_lastMS = Date.now();

var eye = new Vector3([49.6, 52.51, 15.13]);
//var eye = new Vector3([0, -20, 0]);
var aimx;
var aimy;
var aimz;
var aim = new Vector3([0, 0, 0]); //init values, will be changed immediately
var up = new Vector3([0, 0, 1]);
var theta = 3.95;
//var theta = 0;
var deltaZ = -.2;
//var deltaZ = 0;
var velocity = .25;
var near = .01;
var far = 600;
var frust_angle = 35;

var armj1_anglenow  =   0.0;       // init Current rotation angle, in degrees
var armj1_anglerate = 20.0;       // init Rotation angle rate, in degrees/second.
var armj1_anglebrake=	 1.0;				// init Speed control; 0=stop, 1=full speed.
var armj1_anglemin  = -45.0;       // init min, max allowed angle, in degrees.
var armj1_anglemax  =  0.0;

var armj2_anglenow  =   0.0;       // init Current rotation angle, in degrees
var armj2_anglerate = 10.0;       // init Rotation angle rate, in degrees/second.
var armj2_anglebrake=	 1.0;				// init Speed control; 0=stop, 1=full speed.
var armj2_anglemin  = -45.0;       // init min, max allowed angle, in degrees.
var armj2_anglemax  =  45.0;

var armj3_anglenow  =  0.0;       // init Current rotation angle, in degrees
var armj3_anglerate = 90.0;       // init Rotation angle rate, in degrees/second.
var armj3_anglebrake=	 1.0;				// init Speed control; 0=stop, 1=full speed.
var armj3_anglemin  = -180.0;       // init min, max allowed angle, in degrees.
var armj3_anglemax  =  180.0;

var armJ1slider = document.getElementById('armJ1Slider');
var armJ2slider = document.getElementById('armJ2Slider');
var armJ3slider = document.getElementById('armJ3Slider');

var tor_anglenow  =  0.0;       // init Current rotation angle, in degrees
var tor_anglerate = 40.0;       // init Rotation angle rate, in degrees/second.
var tor_anglebrake=	 1.0;				// init Speed control; 0=stop, 1=full speed.
var tor_anglemin  = -359.0;       // init min, max allowed angle, in degrees.
var tor_anglemax  = 359.0;

var tor1_anglenow  =  0.0;       // init Current rotation angle, in degrees
var tor1_anglerate = 20.0;       // init Rotation angle rate, in degrees/second.
var tor1_anglebrake=	 1.0;				// init Speed control; 0=stop, 1=full speed.
var tor1_anglemin  = -45;       // init min, max allowed angle, in degrees.
var tor1_anglemax  = 0.0;

var drop_anglenow  =  0.0;       // init Current rotation angle, in degrees
var drop_anglerate = 50.0;       // init Rotation angle rate, in degrees/second.
var drop_anglebrake=	 1.0;				// init Speed control; 0=stop, 1=full speed.
var drop_anglemin  = -30.0;       // init min, max allowed angle, in degrees.
var drop_anglemax  = 30.0;

var ball_anglenow  =  0.0;       // init Current rotation angle, in degrees
var ball_anglerate = 150.0;       // init Rotation angle rate, in degrees/second.
var ball_anglebrake=	 1.0;				// init Speed control; 0=stop, 1=full speed.
var ball_anglemin  = -359.0;       // init min, max allowed angle, in degrees.
var ball_anglemax  = 359.0;
var ballz = 4;
var ball_rate = 2;
var ball_min = 2;
var ball_max = 6;

var g_isDrag=false;		// mouse-drag: true when user holds down mouse button
var g_xMclik=0.0;			// last mouse button-down position (in CVV coords)
var g_yMclik=0.0;   
var g_xMdragTot=0.0;	// total (accumulated) mouse-drag amounts (in CVV coords).
var g_yMdragTot=0.0;

var qNew = new Quaternion(0,0,0,1);
var qNew2 = new Quaternion(0, 0, 0, 1); // most-recent mouse drag's rotation
var qTot = new Quaternion(0,0,0,1);	// 'current' orientation (made from qNew)
var quatMatrix = new Matrix4();				// rotation matrix, made from latest qTot

function main() {
//==============================================================================
  // Get the rendering context for WebGL; 
  gl = g_canvas.getContext("webgl", {preserveDrawingBuffer: true});
  if (!gl) {
    console.log('Failed to get the rendering context for WebGL');
    return;
  }

  // Initialize shaders
  if (!initShaders(gl, VSHADER_SOURCE, FSHADER_SOURCE)) {
    console.log('Failed to intialize shaders.');
    return;
  }

  // Set up the vertices, colors, and vertex-indices; set the g_vertCount value.
  initVertexBuffers();
  if (g_vertCount < 0) {
    console.log('Failed to send vertex info to GPU (set up, fill VBO) ');
    return;
  }

  // Set clear color and enable hidden surface removal
  gl.clearColor(0.0, 0.0, 0.0, 1.0);
  gl.enable(gl.DEPTH_TEST);

  // Get the GPU storage location for the u_mvpMatrix uniform
  g_mvpMatrixLoc = gl.getUniformLocation(gl.program, 'u_MvpMatrix');
  if (!g_mvpMatrixLoc) { 
    console.log('Failed to get GPU storage location of u_MvpMatrix');
    return;
  }
  window.addEventListener("keydown", myKeyDown, false);
  g_canvas.onmousedown = function(ev){myMouseDown(ev, gl, g_canvas)};
  g_canvas.onmousemove = function(ev){myMouseMove(ev, gl, g_canvas)};
  g_canvas.onmouseup = function(ev){myMouseUp(ev, gl, g_canvas)};
	// Draw our canvas, re-sized to current browser-window 'inner' drawing area
  	// IMPORTANT!  Need a fresh drawing in the re-sized viewports.
  var tick = function() {		    // locally (within main() only), define our 
      // self-calling animation function. 
    requestAnimationFrame(tick, g_canvas); // browser callback request; wait
      // til browser is ready to re-draw canvas, then
    timerAll();  				// Update all our time-varying params, and
    drawResize();         // Draw all parts using transformed VBObox contents
  };
  //------------------------------------
  tick();                       // do it again!  (endless loop)  
  // All subsequent screen re-drawing is done when user re-sizes the browser,
  // which is  done by this line in the HTML file:
  //         <body onload="main()" onresize="drawResize()">
  
  // CHALLENGE:  Suppose we draw something ANIMATED (e.g. BasicShapes);
  //						How can you do this double-call when the program starts, but
  //						call drawResize() only once for all subsequent re-drawing?
}
function timerAll() {
    //Camera Movement Aim Update


    //Animation
    var nowMS = Date.now();             // current time (in milliseconds)
    var elapsedMS = nowMS - g_lastMS;   // 
    g_lastMS = nowMS;
                       // update for next webGL drawing.
    if(elapsedMS > 1000.0) {            
      elapsedMS = 1000.0/30.0;
      };


    armj1_anglenow += armj1_anglerate * armj1_anglebrake * (elapsedMS * 0.001);
    if((armj1_anglenow >= armj1_anglemax && armj1_anglerate > 0) || // going over max, or
      (armj1_anglenow <= armj1_anglemin && armj1_anglerate < 0)  ) {// going under min ?
      armj1_anglerate *= -1; // YES: reverse direction.
      };
    if(armj1_anglemin > armj1_anglemax)	
      {// if min and max don't limit the angle, then
        if(     armj1_anglenow < -180.0) armj1_anglenow += 360.0;	// go to >= -180.0 or
        else if(armj1_anglenow >  180.0) armj1_anglenow -= 360.0;	// go to <= +180.0
      }

    armj2_anglenow += armj2_anglerate * armj2_anglebrake * (elapsedMS * 0.001);
    if((armj2_anglenow >= armj2_anglemax && armj2_anglerate > 0) || // going over max, or
      (armj2_anglenow <= armj2_anglemin && armj2_anglerate < 0)  ) {// going under min ?
      armj2_anglerate *= -1; // YES: reverse direction.
      };
    if(armj2_anglemin > armj2_anglemax)	
      {// if min and max don't limit the angle, then
        if(     armj2_anglenow < -180.0) armj2_anglenow += 360.0;	// go to >= -180.0 or
        else if(armj2_anglenow >  180.0) armj2_anglenow -= 360.0;	// go to <= +180.0
      }

    armj3_anglenow += armj3_anglerate * armj3_anglebrake * (elapsedMS * 0.001);
    if((armj3_anglenow >= armj3_anglemax && armj3_anglerate > 0) || // going over max, or
      (armj3_anglenow <= armj3_anglemin && armj3_anglerate < 0)  ) {// going under min ?
      armj3_anglerate *= -1; // YES: reverse direction.
      };
    if(armj3_anglemin > armj3_anglemax)	
      {// if min and max don't limit the angle, then
        if(     armj3_anglenow < -180.0) armj3_anglenow += 360.0;	// go to >= -180.0 or
        else if(armj3_anglenow >  180.0) armj3_anglenow -= 360.0;	// go to <= +180.0
      }
    armj1_anglemax = armJ1slider.value;
    armj2_anglemax = armJ2slider.value;
    armj3_anglemax = armJ3slider.value;

    tor_anglenow += tor_anglerate * tor_anglebrake * (elapsedMS * 0.001);
    if((tor_anglenow >= tor_anglemax && tor_anglerate > 0) || // going over max, or
      (tor_anglenow <= tor_anglemin && tor_anglerate < 0)  ) {// going under min ?
      tor_anglerate *= -1; // YES: reverse direction.
      };
    if(tor_anglemin > tor_anglemax)	
      {// if min and max don't limit the angle, then
        if(     tor_anglenow < -360.0) tor_anglenow += 360.0;	// go to >= -180.0 or
        else if(tor_anglenow >  360.0) tor_anglenow -= 360.0;	// go to <= +180.0
      }

    tor1_anglenow += tor1_anglerate * tor1_anglebrake * (elapsedMS * 0.001);
    if((tor1_anglenow >= tor1_anglemax && tor1_anglerate > 0) || // going over max, or
      (tor1_anglenow <= tor1_anglemin && tor1_anglerate < 0)  ) {// going under min ?
      tor1_anglerate *= -1; // YES: reverse direction.
      };
    if(tor1_anglemin > tor1_anglemax)	
      {// if min and max don't limit the angle, then
        if(     tor1_anglenow < -360.0) tor1_anglenow += 360.0;	// go to >= -180.0 or
        else if(tor1_anglenow >  360.0) tor1_anglenow -= 360.0;	// go to <= +180.0
      }
      
    drop_anglenow += drop_anglerate * drop_anglebrake * (elapsedMS * 0.001);
    if((drop_anglenow >= drop_anglemax && drop_anglerate > 0) || // going over max, or
      (drop_anglenow <= drop_anglemin && drop_anglerate < 0)  ) {// going under min ?
      drop_anglerate *= -1; // YES: reverse direction.
      };
    if(drop_anglemin > drop_anglemax)	
      {// if min and max don't limit the angle, then
        if(     drop_anglenow < -360.0) drop_anglenow += 360.0;	// go to >= -180.0 or
        else if(drop_anglenow >  360.0) drop_anglenow -= 360.0;	// go to <= +180.0
      }

    ball_anglenow += ball_anglerate * ball_anglebrake * (elapsedMS * 0.001);
    if((ball_anglenow >= ball_anglemax && ball_anglerate > 0) || // going over max, or
      (ball_anglenow <= ball_anglemin && ball_anglerate < 0)  ) {// going under min ?
      ball_anglerate *= -1; // YES: reverse direction.
      };
    if(ball_anglemin > ball_anglemax)	
      {// if min and max don't limit the angle, then
        if(     ball_anglenow < -360.0) ball_anglenow += 360.0;	// go to >= -180.0 or
        else if(ball_anglenow >  360.0) ball_anglenow -= 360.0;	// go to <= +180.0
      }
    
    ballz += ball_rate * (elapsedMS * .001);
    if ((ballz >= ball_max && ball_rate > 0) ||
    (ballz <= ball_min && ball_rate < 0)) {
      ball_rate *= -1;
    };


    
}

function initVertexBuffers() {
//==============================================================================
  // Create a cube
  //    v6----- v5
  //   /|      /|
  //  v1------v0|
  //  | |     | |
  //  | |v7---|-|v4
  //  |/      |/
  //  v2------v3
  initAxes();
  initGrid();
  initArm();
  initDiamond();
  initTorus();
  initIso();
  initWing();
  initDrop();
  initCone();
  initBall();

  var mySiz = (axesVerts.length + gndVerts.length + armVerts.length + diaVerts.length + torusVerts.length
                + isoVerts.length + wingVerts.length + dropVerts.length + coneVerts.length + ballVerts.length);
  var verticesColors = new Float32Array(mySiz);
  
  gridStart = 0;
  for (i=0, j=0; j < gndVerts.length; i++, j++) {
    verticesColors[i] = gndVerts[j];
  };
  axesStart = i/7;
  for (j=0; j < axesVerts.length; i++, j++) {
    verticesColors[i] = axesVerts[j];
  };
  armStart = i/7;
  for (j=0; j < armVerts.length; i++, j++) {
    verticesColors[i] = armVerts[j]
  };
  diaStart = i/7;
  for (j=0; j < diaVerts.length; i++, j++) {
    verticesColors[i] = diaVerts[j];
  };
  torStart = i/7;
  for (j=0; j < torusVerts.length; i++, j++){
    verticesColors[i] = torusVerts[j]
  };
  isoStart = i/7;
  for (j=0; j < isoVerts.length; i++, j++) {
    verticesColors[i] = isoVerts[j];
  };
  wingStart = i/7;
  for (j=0; j < wingVerts.length; i++, j++) {
    verticesColors[i] = wingVerts[j];
  };
  dropStart = i/7;
  for (j=0; j < dropVerts.length; i++, j++) {
    verticesColors[i] = dropVerts[j];
  }
  coneStart = i/7;
  for (j=0; j < coneVerts.length; i++, j++) {
    verticesColors[i] = coneVerts[j];
  }
  ballStart = i/7;
  for (j=0; j < ballVerts.length; i++, j++) {
    verticesColors[i] = ballVerts[j];
  }



  // Create a buffer object in GPU; get its ID:
  var vertexBufferID = gl.createBuffer();
  if (!vertexBufferID) {
    console.log('Failed to create the buffer object');
    return -1;	// error code
  }


  // In GPU, bind the buffer object to target for reading vertices;
  gl.bindBuffer(gl.ARRAY_BUFFER, vertexBufferID);
  // Write JS vertex array contents into the buffer object on the GPU:
  gl.bufferData(gl.ARRAY_BUFFER, verticesColors, gl.STATIC_DRAW);

  // On GPU, get location of vertex shader's 'a_position' attribute var
  var aLoc_Position = gl.getAttribLocation(gl.program, 'a_Position');
  if(aLoc_Position < 0) {
    console.log('Failed to get the storage location of a_Position');
    return -2;  // error code
  }
  // Now connect the 'a_position' data in our VBO to the 'a_position' attribute
  // in the shaders in the GPU:
  var FSIZE = verticesColors.BYTES_PER_ELEMENT;
  gl.vertexAttribPointer(aLoc_Position, 4, gl.FLOAT, false, FSIZE * 7, 0);
	// websearch yields OpenGL version: 
	//		http://www.opengl.org/sdk/docs/man/xhtml/glVertexAttribPointer.xml
				//	glVertexAttributePointer (
				//			index == which attribute variable will we use?
				//			size == how many dimensions for this attribute: 1,2,3 or 4?
				//			type == what data type did we use for those numbers?
				//			isNormalized == are these fixed-point values that we need
				//						normalize before use? true or false
				//			stride == #bytes (of other, interleaved data) between OUR values?
				//			pointer == offset; how many (interleaved) values to skip to reach
				//					our first value?
				//				)
  // Enable the assignment of that VBO data to the shaders' a_Position variable
  gl.enableVertexAttribArray(aLoc_Position);


  var a_ColorLoc = gl.getAttribLocation(gl.program, 'a_Color');
  if(a_ColorLoc < 0) {
    console.log('Failed to get the attribute storage location of a_Color');
    return -1;
  }
  gl.vertexAttribPointer(a_ColorLoc, 3, gl.FLOAT, false, FSIZE * 7, FSIZE * 4);
  gl.enableVertexAttribArray(a_ColorLoc);
  gl.bindBuffer(gl.ARRAY_BUFFER, null);
  return 0;	// normal exit; no error.
}

function initGrid() {
//==============================================================================
// Create a list of vertices that create a large grid of lines in the x,y plane
// centered at x=y=z=0.  Draw this shape using the GL_LINES primitive.

	var xcount = 200;			// # of lines to draw in x,y to make the grid.
	var ycount = 200;		
	var xymax	= 50.0;			// grid size; extends to cover +/-xymax in x and y.
 	var xColr = new Float32Array([1.0, 1.0, 1.0]);	// bright yellow
 	var yColr = new Float32Array([0.5, .5, 0.5]);	// bright green.
 	
	// Create an (global) array to hold this ground-plane's vertices:
	gndVerts = new Float32Array(7*2*(xcount+ycount));
						// draw a grid made of xcount+ycount lines; 2 vertices per line.
						
	var xgap = xymax/(xcount-1);		// HALF-spacing between lines in x,y;
	var ygap = xymax/(ycount-1);		// (why half? because v==(0line number/2))
	
	// First, step thru x values as we make vertical lines of constant-x:
	for(v=0, j=0; v<2*xcount; v++, j+= 7) {
		if(v%2==0) {	// put even-numbered vertices at (xnow, -xymax, 0)
			gndVerts[j  ] = -xymax + (v  )*xgap;	// x
			gndVerts[j+1] = -xymax;								// y
			gndVerts[j+2] = 0.0;									// z
			gndVerts[j+3] = 1.0;									// w.
		}
		else {				// put odd-numbered vertices at (xnow, +xymax, 0).
			gndVerts[j  ] = -xymax + (v-1)*xgap;	// x
			gndVerts[j+1] = xymax;								// y
			gndVerts[j+2] = 0.0;									// z
			gndVerts[j+3] = 1.0;									// w.
		}
		gndVerts[j+4] = xColr[0];			// red
		gndVerts[j+5] = xColr[1];			// grn
		gndVerts[j+6] = xColr[2];			// blu
	}
	// Second, step thru y values as wqe make horizontal lines of constant-y:
	// (don't re-initialize j--we're adding more vertices to the array)
	for(v=0; v<2*ycount; v++, j+= 7) {
		if(v%2==0) {		// put even-numbered vertices at (-xymax, ynow, 0)
			gndVerts[j  ] = -xymax;								// x
			gndVerts[j+1] = -xymax + (v  )*ygap;	// y
			gndVerts[j+2] = 0.0;									// z
			gndVerts[j+3] = 1.0;									// w.
		}
		else {					// put odd-numbered vertices at (+xymax, ynow, 0).
			gndVerts[j  ] = xymax;								// x
			gndVerts[j+1] = -xymax + (v-1)*ygap;	// y
			gndVerts[j+2] = 0.0;									// z
			gndVerts[j+3] = 1.0;									// w.
		}
		gndVerts[j+4] = yColr[0];			// red
		gndVerts[j+5] = yColr[1];			// grn
		gndVerts[j+6] = yColr[2];			// blu
	}
    gndVertsLen = gndVerts.length/7
};

function initArm() {
    armVerts = new Float32Array([
        // Vertex coordinates and color
        0.03948449063044879,0.9996469638756469,-0.09882521072014716,1.0,0.6383013311929239,0.036830761426397615,-0.7689050042821239,
        0.13660445476854632,-0.09764678161048501,-0.07076239656246808,1.0,0.6383013311929239,0.036830761426397615,-0.7689050042821239,
        -0.02032475492040675,-0.09649024621396118,-0.20098072888002438,1.0,0.6383013311929239,0.036830761426397615,-0.7689050042821239,
        0.06060809240898446,0.9996885619306095,0.00996246049211047,1.0,0.9113862235655839,0.0329399176915873,0.4102317799943528,
        0.05280134164674122,-0.09649024621396118,0.11532486028390143,1.0,0.9113862235655839,0.0329399176915873,0.4102317799943528,
        0.13660445476854632,-0.09764678161048501,-0.07076239656246808,1.0,0.9113862235655839,0.0329399176915873,0.4102317799943528,
        -0.10636376349644783,1.0,0.05338426175904498,1.0,-0.03200562494405549,0.05173934088599977,0.9981476246410763,
        -0.12027229211029944,-0.09578472130808369,0.10973867937669701,1.0,-0.03200562494405549,0.05173934088599977,0.9981476246410763,
        0.05280134164674122,-0.09649024621396118,0.11532486028390143,1.0,-0.03200562494405549,0.05173934088599977,0.9981476246410763,
        -0.10636376349644783,1.0,0.05338426175904498,1.0,-0.9161611248622411,0.0321750986880587,0.3995166533644959,
        -0.2020672043945061,-0.09944042405932985,-0.07753685875024663,1.0,-0.9161611248622411,0.0321750986880587,0.3995166533644959,
        -0.12027229211029944,-0.09578472130808369,0.10973867937669701,1.0,-0.9161611248622411,0.0321750986880587,0.3995166533644959,
        -0.07756641526298313,0.9996989614443501,-0.12446548551908765,1.0,-0.5619600962153364,0.02835819400727547,-0.8266780891582258,
        -0.02032475492040675,-0.09649024621396118,-0.20098072888002438,1.0,-0.5619600962153364,0.02835819400727547,-0.8266780891582258,
        -0.2020672043945061,-0.09944042405932985,-0.07753685875024663,1.0,-0.5619600962153364,0.02835819400727547,-0.8266780891582258,
        -0.10639550938049813,-0.99981937686661,-0.0653081252769212,1.0,-0.000647789868872095,-0.999999605296852,0.0006080908042129928,
        -0.014608853762858809,-0.9999107831189619,-0.11784592135176164,1.0,-0.000647789868872095,-0.999999605296852,0.0006080908042129928,
        0.05182871344057771,-0.9998877947201669,-0.009266787757145067,1.0,-0.000647789868872095,-0.999999605296852,0.0006080908042129928,
        -0.02032475492040675,-0.09649024621396118,-0.20098072888002438,1.0,-0.5592106587914867,-0.0794755480861925,-0.8252072929575882,
        -0.014608853762858809,-0.9999107831189619,-0.11784592135176164,1.0,-0.5592106587914867,-0.0794755480861925,-0.8252072929575882,
        -0.2020672043945061,-0.09944042405932985,-0.07753685875024663,1.0,-0.5592106587914867,-0.0794755480861925,-0.8252072929575882,
        -0.12027229211029944,-0.09578472130808369,0.10973867937669701,1.0,-0.03246346396145241,-0.06891447791251981,0.997094237392669,
        -0.07474541032512982,-1.0,0.04872582694607064,1.0,-0.03246346396145241,-0.06891447791251981,0.997094237392669,
        0.05280134164674122,-0.09649024621396118,0.11532486028390143,1.0,-0.03246346396145241,-0.06891447791251981,0.997094237392669,
        0.13660445476854632,-0.09764678161048501,-0.07076239656246808,1.0,0.636862894460192,-0.06665203616112453,-0.7680905934428324,
        -0.014608853762858809,-0.9999107831189619,-0.11784592135176164,1.0,0.636862894460192,-0.06665203616112453,-0.7680905934428324,
        -0.02032475492040675,-0.09649024621396118,-0.20098072888002438,1.0,0.636862894460192,-0.06665203616112453,-0.7680905934428324,
        -0.2020672043945061,-0.09944042405932985,-0.07753685875024663,1.0,-0.913436357242469,-0.07300719555261899,0.4003797830374932,
        -0.07474541032512982,-1.0,0.04872582694607064,1.0,-0.913436357242469,-0.07300719555261899,0.4003797830374932,
        -0.12027229211029944,-0.09578472130808369,0.10973867937669701,1.0,-0.913436357242469,-0.07300719555261899,0.4003797830374932,
        0.05280134164674122,-0.09649024621396118,0.11532486028390143,1.0,0.41336579061665424,-0.12483935153167444,0.9019666620541026,
        -0.07474541032512982,-1.0,0.04872582694607064,1.0,0.41336579061665424,-0.12483935153167444,0.9019666620541026,
        0.05182871344057771,-0.9998877947201669,-0.009266787757145067,1.0,0.41336579061665424,-0.12483935153167444,0.9019666620541026,
        0.13660445476854632,-0.09764678161048501,-0.07076239656246808,1.0,0.8473454479146065,-0.11495462771361585,-0.5184506972370843,
        0.05182871344057771,-0.9998877947201669,-0.009266787757145067,1.0,0.8473454479146065,-0.11495462771361585,-0.5184506972370843,
        -0.014608853762858809,-0.9999107831189619,-0.11784592135176164,1.0,0.8473454479146065,-0.11495462771361585,-0.5184506972370843,
        0.05280134164674122,-0.09649024621396118,0.11532486028390143,1.0,0.9101587801467501,-0.0575581651020408,0.4102414564032577,
        0.05182871344057771,-0.9998877947201669,-0.009266787757145067,1.0,0.9101587801467501,-0.0575581651020408,0.4102414564032577,
        0.13660445476854632,-0.09764678161048501,-0.07076239656246808,1.0,0.9101587801467501,-0.0575581651020408,0.4102414564032577,
        -0.07756641526298313,0.9996989614443501,-0.12446548551908765,1.0,0.21334161088779902,0.07911064147510266,-0.973769409803572,
        0.03948449063044879,0.9996469638756469,-0.09882521072014716,1.0,0.21334161088779902,0.07911064147510266,-0.973769409803572,
        -0.02032475492040675,-0.09649024621396118,-0.20098072888002438,1.0,0.21334161088779902,0.07911064147510266,-0.973769409803572,
        0.03948449063044879,0.9996469638756469,-0.09882521072014716,1.0,0.9783748954040455,0.0817353238890026,-0.1900050022285803,
        0.06060809240898446,0.9996885619306095,0.00996246049211047,1.0,0.9783748954040455,0.0817353238890026,-0.1900050022285803,
        0.13660445476854632,-0.09764678161048501,-0.07076239656246808,1.0,0.9783748954040455,0.0817353238890026,-0.1900050022285803,
        0.06060809240898446,0.9996885619306095,0.00996246049211047,1.0,0.25080128268377294,0.09084901977839861,0.963766139791951,
        -0.10636376349644783,1.0,0.05338426175904498,1.0,0.25080128268377294,0.09084901977839861,0.963766139791951,
        0.05280134164674122,-0.09649024621396118,0.11532486028390143,1.0,0.25080128268377294,0.09084901977839861,0.963766139791951,
        -0.10636376349644783,1.0,0.05338426175904498,1.0,-0.9817204038360361,0.10440614918319027,-0.1591364342466788,
        -0.07756641526298313,0.9996989614443501,-0.12446548551908765,1.0,-0.9817204038360361,0.10440614918319027,-0.1591364342466788,
        -0.2020672043945061,-0.09944042405932985,-0.07753685875024663,1.0,-0.9817204038360361,0.10440614918319027,-0.1591364342466788,
        -0.10636376349644783,1.0,0.05338426175904498,1.0,0.001680893179959368,0.9999983361263018,-0.0007087614162085538,
        0.06060809240898446,0.9996885619306095,0.00996246049211047,1.0,0.001680893179959368,0.9999983361263018,-0.0007087614162085538,
        0.03948449063044879,0.9996469638756469,-0.09882521072014716,1.0,0.001680893179959368,0.9999983361263018,-0.0007087614162085538,
        -0.2020672043945061,-0.09944042405932985,-0.07753685875024663,1.0,-0.9589495555336018,-0.09828248323247027,0.26600057035947644,
        -0.10639550938049813,-0.99981937686661,-0.0653081252769212,1.0,-0.9589495555336018,-0.09828248323247027,0.26600057035947644,
        -0.07474541032512982,-1.0,0.04872582694607064,1.0,-0.9589495555336018,-0.09828248323247027,0.26600057035947644,
        -0.2020672043945061,-0.09944042405932985,-0.07753685875024663,1.0,-0.4957838013782659,-0.06444307879747362,-0.866051679685467,
        -0.014608853762858809,-0.9999107831189619,-0.11784592135176164,1.0,-0.4957838013782659,-0.06444307879747362,-0.866051679685467,
        -0.10639550938049813,-0.99981937686661,-0.0653081252769212,1.0,-0.4957838013782659,-0.06444307879747362,-0.866051679685467,
      ]);
    var colors = [.79, 0, 1,
        0, .69, 1,
        1, 1, 1,
        1, 1, 1,
        0, .69, 1,
        .79, 0, 1]
    
      // Indices of the vertices;
    var colors_start = 0
    for (i = 0; i < armVerts.length; i+=7) {
        armVerts[i+3] = 1.0;
        armVerts[i+4] = colors[colors_start];
        armVerts[i+5] = colors[colors_start + 1];
        armVerts[i+6] = colors[colors_start + 2];
        if (colors_start == 15) {
            colors_start = 0;
        }
        else {
            colors_start += 3;
        }
    }
    armLen = armVerts.length/7;
};

function initDiamond() {
  diaVerts = new Float32Array([
    0.0013799999999999368,0.0013799999999999368,1.0,1.0,-0.0,0.0,1.0,
    -0.0013800000000000479,-0.0013800000000000479,1.0,1.0,-0.0,0.0,1.0,
    0.0013799999999999368,-0.0013800000000000479,1.0,1.0,-0.0,0.0,1.0,
    1.0,0.0013799999999999368,-0.0013800000000000479,1.0,1.0,0.0,0.0,
    1.0,-0.0013800000000000479,0.0013799999999999368,1.0,1.0,0.0,0.0,
    1.0,-0.0013800000000000479,-0.0013800000000000479,1.0,1.0,0.0,0.0,
    -0.0013800000000000479,1.0,-0.0013800000000000479,1.0,-0.0,1.0,0.0,
    0.0013799999999999368,1.0,0.0013799999999999368,1.0,-0.0,1.0,0.0,
    0.0013799999999999368,1.0,-0.0013800000000000479,1.0,-0.0,1.0,0.0,
    -1.0,0.0013799999999999368,0.0013799999999999368,1.0,-1.0,-0.0,0.0,
    -1.0,-0.0013800000000000479,-0.0013800000000000479,1.0,-1.0,-0.0,0.0,
    -1.0,-0.0013800000000000479,0.0013799999999999368,1.0,-1.0,-0.0,0.0,
    -0.0013800000000000479,0.0013799999999999368,-1.0,1.0,-0.0,-0.0,-1.0,
    0.0013799999999999368,-0.0013800000000000479,-1.0,1.0,-0.0,-0.0,-1.0,
    -0.0013800000000000479,-0.0013800000000000479,-1.0,1.0,-0.0,-0.0,-1.0,
    -0.0013800000000000479,-1.0,0.0013799999999999368,1.0,-0.5773502691896258,-0.5773502691896258,0.5773502691896257,
    -0.0013800000000000479,-0.0013800000000000479,1.0,1.0,-0.5773502691896258,-0.5773502691896258,0.5773502691896257,
    -1.0,-0.0013800000000000479,0.0013799999999999368,1.0,-0.5773502691896258,-0.5773502691896258,0.5773502691896257,
    -0.0013800000000000479,0.0013799999999999368,1.0,1.0,-0.5773502691896258,0.5773502691896257,0.5773502691896257,
    -0.0013800000000000479,1.0,0.0013799999999999368,1.0,-0.5773502691896258,0.5773502691896257,0.5773502691896257,
    -1.0,0.0013799999999999368,0.0013799999999999368,1.0,-0.5773502691896258,0.5773502691896257,0.5773502691896257,
    -0.0013800000000000479,-1.0,-0.0013800000000000479,1.0,-0.5773502691896257,-0.5773502691896257,-0.5773502691896257,
    -1.0,-0.0013800000000000479,-0.0013800000000000479,1.0,-0.5773502691896257,-0.5773502691896257,-0.5773502691896257,
    -0.0013800000000000479,-0.0013800000000000479,-1.0,1.0,-0.5773502691896257,-0.5773502691896257,-0.5773502691896257,
    -0.0013800000000000479,1.0,-0.0013800000000000479,1.0,-0.5773502691896258,0.5773502691896257,-0.5773502691896258,
    -0.0013800000000000479,0.0013799999999999368,-1.0,1.0,-0.5773502691896258,0.5773502691896257,-0.5773502691896258,
    -1.0,0.0013799999999999368,-0.0013800000000000479,1.0,-0.5773502691896258,0.5773502691896257,-0.5773502691896258,
    0.0013799999999999368,-1.0,0.0013799999999999368,1.0,0.5773502691896257,-0.5773502691896258,0.5773502691896257,
    1.0,-0.0013800000000000479,0.0013799999999999368,1.0,0.5773502691896257,-0.5773502691896258,0.5773502691896257,
    0.0013799999999999368,-0.0013800000000000479,1.0,1.0,0.5773502691896257,-0.5773502691896258,0.5773502691896257,
    0.0013799999999999368,1.0,0.0013799999999999368,1.0,0.5773502691896258,0.5773502691896258,0.5773502691896258,
    0.0013799999999999368,0.0013799999999999368,1.0,1.0,0.5773502691896258,0.5773502691896258,0.5773502691896258,
    1.0,0.0013799999999999368,0.0013799999999999368,1.0,0.5773502691896258,0.5773502691896258,0.5773502691896258,
    0.0013799999999999368,-1.0,-0.0013800000000000479,1.0,0.5773502691896257,-0.5773502691896258,-0.5773502691896258,
    0.0013799999999999368,-0.0013800000000000479,-1.0,1.0,0.5773502691896257,-0.5773502691896258,-0.5773502691896258,
    1.0,-0.0013800000000000479,-0.0013800000000000479,1.0,0.5773502691896257,-0.5773502691896258,-0.5773502691896258,
    0.0013799999999999368,1.0,-0.0013800000000000479,1.0,0.5773502691896257,0.5773502691896257,-0.5773502691896258,
    1.0,0.0013799999999999368,-0.0013800000000000479,1.0,0.5773502691896257,0.5773502691896257,-0.5773502691896258,
    0.0013799999999999368,0.0013799999999999368,-1.0,1.0,0.5773502691896257,0.5773502691896257,-0.5773502691896258,
    -0.0013800000000000479,-1.0,0.0013799999999999368,1.0,-0.7071067811865476,-0.7071067811865476,0.0,
    -1.0,-0.0013800000000000479,-0.0013800000000000479,1.0,-0.7071067811865476,-0.7071067811865476,0.0,
    -0.0013800000000000479,-1.0,-0.0013800000000000479,1.0,-0.7071067811865476,-0.7071067811865476,0.0,
    -0.0013800000000000479,0.0013799999999999368,1.0,1.0,-0.7071067811865476,0.0,0.7071067811865476,
    -1.0,-0.0013800000000000479,0.0013799999999999368,1.0,-0.7071067811865476,0.0,0.7071067811865476,
    -0.0013800000000000479,-0.0013800000000000479,1.0,1.0,-0.7071067811865476,0.0,0.7071067811865476,
    -0.0013800000000000479,1.0,-0.0013800000000000479,1.0,-0.7071067811865476,0.7071067811865476,0.0,
    -1.0,0.0013799999999999368,0.0013799999999999368,1.0,-0.7071067811865476,0.7071067811865476,0.0,
    -0.0013800000000000479,1.0,0.0013799999999999368,1.0,-0.7071067811865476,0.7071067811865476,0.0,
    -0.0013800000000000479,-0.0013800000000000479,-1.0,1.0,-0.7071067811865476,0.0,-0.7071067811865476,
    -1.0,0.0013799999999999368,-0.0013800000000000479,1.0,-0.7071067811865476,0.0,-0.7071067811865476,
    -0.0013800000000000479,0.0013799999999999368,-1.0,1.0,-0.7071067811865476,0.0,-0.7071067811865476,
    -0.0013800000000000479,-1.0,-0.0013800000000000479,1.0,0.0,-0.7071067811865476,-0.7071067811865476,
    0.0013799999999999368,-0.0013800000000000479,-1.0,1.0,0.0,-0.7071067811865476,-0.7071067811865476,
    0.0013799999999999368,-1.0,-0.0013800000000000479,1.0,0.0,-0.7071067811865476,-0.7071067811865476,
    0.0013799999999999368,1.0,-0.0013800000000000479,1.0,0.0,0.7071067811865476,-0.7071067811865476,
    -0.0013800000000000479,0.0013799999999999368,-1.0,1.0,0.0,0.7071067811865476,-0.7071067811865476,
    -0.0013800000000000479,1.0,-0.0013800000000000479,1.0,0.0,0.7071067811865476,-0.7071067811865476,
    1.0,-0.0013800000000000479,-0.0013800000000000479,1.0,0.7071067811865476,0.0,-0.7071067811865476,
    0.0013799999999999368,0.0013799999999999368,-1.0,1.0,0.7071067811865476,0.0,-0.7071067811865476,
    1.0,0.0013799999999999368,-0.0013800000000000479,1.0,0.7071067811865476,0.0,-0.7071067811865476,
    0.0013799999999999368,-1.0,-0.0013800000000000479,1.0,0.7071067811865476,-0.7071067811865476,0.0,
    1.0,-0.0013800000000000479,0.0013799999999999368,1.0,0.7071067811865476,-0.7071067811865476,0.0,
    0.0013799999999999368,-1.0,0.0013799999999999368,1.0,0.7071067811865476,-0.7071067811865476,0.0,
    0.0013799999999999368,1.0,0.0013799999999999368,1.0,0.7071067811865476,0.7071067811865476,0.0,
    1.0,0.0013799999999999368,-0.0013800000000000479,1.0,0.7071067811865476,0.7071067811865476,0.0,
    0.0013799999999999368,1.0,-0.0013800000000000479,1.0,0.7071067811865476,0.7071067811865476,0.0,
    0.0013799999999999368,-0.0013800000000000479,1.0,1.0,0.7071067811865476,0.0,0.7071067811865476,
    1.0,0.0013799999999999368,0.0013799999999999368,1.0,0.7071067811865476,0.0,0.7071067811865476,
    0.0013799999999999368,0.0013799999999999368,1.0,1.0,0.7071067811865476,0.0,0.7071067811865476,
    0.0013799999999999368,-1.0,0.0013799999999999368,1.0,0.0,-0.7071067811865476,0.7071067811865476,
    -0.0013800000000000479,-0.0013800000000000479,1.0,1.0,0.0,-0.7071067811865476,0.7071067811865476,
    -0.0013800000000000479,-1.0,0.0013799999999999368,1.0,0.0,-0.7071067811865476,0.7071067811865476,
    -0.0013800000000000479,1.0,0.0013799999999999368,1.0,0.0,0.7071067811865476,0.7071067811865476,
    0.0013799999999999368,0.0013799999999999368,1.0,1.0,0.0,0.7071067811865476,0.7071067811865476,
    0.0013799999999999368,1.0,0.0013799999999999368,1.0,0.0,0.7071067811865476,0.7071067811865476,
    0.0013799999999999368,-1.0,-0.0013800000000000479,1.0,-0.0,-1.0,-0.0,
    -0.0013800000000000479,-1.0,0.0013799999999999368,1.0,-0.0,-1.0,-0.0,
    -0.0013800000000000479,-1.0,-0.0013800000000000479,1.0,-0.0,-1.0,-0.0,
    0.0013799999999999368,0.0013799999999999368,1.0,1.0,0.0,0.0,1.0,
    -0.0013800000000000479,0.0013799999999999368,1.0,1.0,0.0,0.0,1.0,
    -0.0013800000000000479,-0.0013800000000000479,1.0,1.0,0.0,0.0,1.0,
    1.0,0.0013799999999999368,-0.0013800000000000479,1.0,1.0,0.0,-0.0,
    1.0,0.0013799999999999368,0.0013799999999999368,1.0,1.0,0.0,-0.0,
    1.0,-0.0013800000000000479,0.0013799999999999368,1.0,1.0,0.0,-0.0,
    -0.0013800000000000479,1.0,-0.0013800000000000479,1.0,0.0,1.0,0.0,
    -0.0013800000000000479,1.0,0.0013799999999999368,1.0,0.0,1.0,0.0,
    0.0013799999999999368,1.0,0.0013799999999999368,1.0,0.0,1.0,0.0,
    -1.0,0.0013799999999999368,0.0013799999999999368,1.0,-1.0,-0.0,-0.0,
    -1.0,0.0013799999999999368,-0.0013800000000000479,1.0,-1.0,-0.0,-0.0,
    -1.0,-0.0013800000000000479,-0.0013800000000000479,1.0,-1.0,-0.0,-0.0,
    -0.0013800000000000479,0.0013799999999999368,-1.0,1.0,0.0,0.0,-1.0,
    0.0013799999999999368,0.0013799999999999368,-1.0,1.0,0.0,0.0,-1.0,
    0.0013799999999999368,-0.0013800000000000479,-1.0,1.0,0.0,0.0,-1.0,
    -0.0013800000000000479,-1.0,0.0013799999999999368,1.0,-0.7071067811865476,-0.7071067811865476,-0.0,
    -1.0,-0.0013800000000000479,0.0013799999999999368,1.0,-0.7071067811865476,-0.7071067811865476,-0.0,
    -1.0,-0.0013800000000000479,-0.0013800000000000479,1.0,-0.7071067811865476,-0.7071067811865476,-0.0,
    -0.0013800000000000479,0.0013799999999999368,1.0,1.0,-0.7071067811865476,0.0,0.7071067811865476,
    -1.0,0.0013799999999999368,0.0013799999999999368,1.0,-0.7071067811865476,0.0,0.7071067811865476,
    -1.0,-0.0013800000000000479,0.0013799999999999368,1.0,-0.7071067811865476,0.0,0.7071067811865476,
    -0.0013800000000000479,1.0,-0.0013800000000000479,1.0,-0.7071067811865476,0.7071067811865476,0.0,
    -1.0,0.0013799999999999368,-0.0013800000000000479,1.0,-0.7071067811865476,0.7071067811865476,0.0,
    -1.0,0.0013799999999999368,0.0013799999999999368,1.0,-0.7071067811865476,0.7071067811865476,0.0,
    -0.0013800000000000479,-0.0013800000000000479,-1.0,1.0,-0.7071067811865476,0.0,-0.7071067811865476,
    -1.0,-0.0013800000000000479,-0.0013800000000000479,1.0,-0.7071067811865476,0.0,-0.7071067811865476,
    -1.0,0.0013799999999999368,-0.0013800000000000479,1.0,-0.7071067811865476,0.0,-0.7071067811865476,
    -0.0013800000000000479,-1.0,-0.0013800000000000479,1.0,0.0,-0.7071067811865476,-0.7071067811865476,
    -0.0013800000000000479,-0.0013800000000000479,-1.0,1.0,0.0,-0.7071067811865476,-0.7071067811865476,
    0.0013799999999999368,-0.0013800000000000479,-1.0,1.0,0.0,-0.7071067811865476,-0.7071067811865476,
    0.0013799999999999368,1.0,-0.0013800000000000479,1.0,0.0,0.7071067811865476,-0.7071067811865476,
    0.0013799999999999368,0.0013799999999999368,-1.0,1.0,0.0,0.7071067811865476,-0.7071067811865476,
    -0.0013800000000000479,0.0013799999999999368,-1.0,1.0,0.0,0.7071067811865476,-0.7071067811865476,
    1.0,-0.0013800000000000479,-0.0013800000000000479,1.0,0.7071067811865476,0.0,-0.7071067811865476,
    0.0013799999999999368,-0.0013800000000000479,-1.0,1.0,0.7071067811865476,0.0,-0.7071067811865476,
    0.0013799999999999368,0.0013799999999999368,-1.0,1.0,0.7071067811865476,0.0,-0.7071067811865476,
    0.0013799999999999368,-1.0,-0.0013800000000000479,1.0,0.7071067811865476,-0.7071067811865476,0.0,
    1.0,-0.0013800000000000479,-0.0013800000000000479,1.0,0.7071067811865476,-0.7071067811865476,0.0,
    1.0,-0.0013800000000000479,0.0013799999999999368,1.0,0.7071067811865476,-0.7071067811865476,0.0,
    0.0013799999999999368,1.0,0.0013799999999999368,1.0,0.7071067811865476,0.7071067811865476,0.0,
    1.0,0.0013799999999999368,0.0013799999999999368,1.0,0.7071067811865476,0.7071067811865476,0.0,
    1.0,0.0013799999999999368,-0.0013800000000000479,1.0,0.7071067811865476,0.7071067811865476,0.0,
    0.0013799999999999368,-0.0013800000000000479,1.0,1.0,0.7071067811865476,-0.0,0.7071067811865476,
    1.0,-0.0013800000000000479,0.0013799999999999368,1.0,0.7071067811865476,-0.0,0.7071067811865476,
    1.0,0.0013799999999999368,0.0013799999999999368,1.0,0.7071067811865476,-0.0,0.7071067811865476,
    0.0013799999999999368,-1.0,0.0013799999999999368,1.0,0.0,-0.7071067811865476,0.7071067811865476,
    0.0013799999999999368,-0.0013800000000000479,1.0,1.0,0.0,-0.7071067811865476,0.7071067811865476,
    -0.0013800000000000479,-0.0013800000000000479,1.0,1.0,0.0,-0.7071067811865476,0.7071067811865476,
    -0.0013800000000000479,1.0,0.0013799999999999368,1.0,-0.0,0.7071067811865476,0.7071067811865476,
    -0.0013800000000000479,0.0013799999999999368,1.0,1.0,-0.0,0.7071067811865476,0.7071067811865476,
    0.0013799999999999368,0.0013799999999999368,1.0,1.0,-0.0,0.7071067811865476,0.7071067811865476,
    0.0013799999999999368,-1.0,-0.0013800000000000479,1.0,0.0,-1.0,0.0,
    0.0013799999999999368,-1.0,0.0013799999999999368,1.0,0.0,-1.0,0.0,
    -0.0013800000000000479,-1.0,0.0013799999999999368,1.0,0.0,-1.0,0.0
  ]);
  var colors = [
    .608, .047, 1,
    .047, 1, .714,
    .98, .482, .349,
    .98, .482, .349,
    .047, 1, .714,
    .608, .047, 1
  ];
  var colors_start = 0;
  for (i = 0; i < diaVerts.length; i+=7) {
    diaVerts[i+3] = 1.0;
    diaVerts[i+4] = colors[colors_start]
    diaVerts[i+5] = colors[colors_start + 1];
    diaVerts[i+6] = colors[colors_start + 2];
    if (colors_start == 15) {
      colors_start = 0;
    }
    else {
      colors_start += 3;
    }
  }
  diaLen = diaVerts.length/7;
}

function initAxes() {
  axesVerts = new Float32Array ([
    0.0, 0.0, 0.0, 1.0, 1.0, 0.0, 0.0,
    3.0, 0.0, 0.0, 1.0, 1.0, 0.0, 0.0,

    0.0, 0.0, 0.0, 1.0, 0.0, 1.0, 0.0,
    0.0, 3.0, 0.0, 1.0, 0.0, 1.0, 0.0,

    0.0, 0.0, 0.0, 1.0, 0.0, 0.0, 1.0,
    0.0, 0.0, 3.0, 1.0, 0.0, 0.0, 1.0,
  ]);
  axesVertsLen = axesVerts.length/7;
};

function initTorus() {
  torusVerts = new Float32Array ([
    0.6214129937094277,-0.10358066466606353,-0.04490428534279067,1.0,-0.8296855428916006,-0.5576902496860495,0.024565938243465618,
    0.6648519250619407,-0.17640006317693846,-0.23093484319834845,1.0,-0.8296855428916006,-0.5576902496860495,0.024565938243465618,
    0.6772831044764691,-0.17621499941768726,0.1931148304672381,1.0,-0.8296855428916006,-0.5576902496860495,0.024565938243465618,
    0.6648519250619407,-0.17640006317693846,-0.23093484319834845,1.0,-0.22567459185946248,-0.9741772962276506,0.007040887987281144,
    0.7809108327709628,-0.2030994988920105,-0.20514796326165308,1.0,-0.22567459185946248,-0.9741772962276506,0.007040887987281144,
    0.6772831044764691,-0.17621499941768726,0.1931148304672381,1.0,-0.22567459185946248,-0.9741772962276506,0.007040887987281144,
    0.8687004535657479,-0.1763490111054209,-0.2391279029883011,1.0,0.6255535895243203,-0.7801088297398494,-0.01062640085639921,
    0.9565403287434329,-0.10661427447827176,-0.18757089457587706,1.0,0.6255535895243203,-0.7801088297398494,-0.01062640085639921,
    0.8747788408308088,-0.17785185646071933,0.229021188205057,1.0,0.6255535895243203,-0.7801088297398494,-0.01062640085639921,
    0.9078087334140592,-0.0039182464889735424,-0.4325961095130749,1.0,0.9786497511444853,0.10653133306972695,-0.17577183977879907,
    0.9720226671197536,0.09448621673837887,-0.015429690927568407,1.0,0.9786497511444853,0.10653133306972695,-0.17577183977879907,
    1.0,-0.0039182464889735424,0.08069976436278248,1.0,0.9786497511444853,0.10653133306972695,-0.17577183977879907,
    0.893282026001458,0.09787080954227023,-0.3858180536078659,1.0,0.770640378831243,0.6173246153081203,-0.15818889293980004,
    0.9033680008806482,0.167903084023733,-0.06338513523215128,1.0,0.770640378831243,0.6173246153081203,-0.15818889293980004,
    0.9720226671197536,0.09448621673837887,-0.015429690927568407,1.0,0.770640378831243,0.6173246153081203,-0.15818889293980004,
    0.6214129937094277,0.09574417168811644,-0.04490508303140828,1.0,-0.9199373907556527,0.3524526529184144,0.17173329479298216,
    0.5409724781473202,-0.00598904613990503,-0.2670174901206265,1.0,-0.9199373907556527,0.3524526529184144,0.17173329479298216,
    0.5982489139469473,-0.0039182464889735424,0.03554979092581334,1.0,-0.9199373907556527,0.3524526529184144,0.17173329479298216,
    0.5409724781473202,-0.00598904613990503,-0.2670174901206265,1.0,-0.9178906179787323,-0.35557463038519244,0.17619164467435725,
    0.6214129937094277,-0.10358066466606353,-0.04490428534279067,1.0,-0.9178906179787323,-0.35557463038519244,0.17619164467435725,
    0.5982489139469473,-0.0039182464889735424,0.03554979092581334,1.0,-0.9178906179787323,-0.35557463038519244,0.17619164467435725,
    0.9565403287434329,-0.10661427447827176,-0.18757089457587706,1.0,0.9832437646842479,0.04522405232466686,-0.17659695439299936,
    0.9078087334140592,-0.0039182464889735424,-0.4325961095130749,1.0,0.9832437646842479,0.04522405232466686,-0.17659695439299936,
    1.0,-0.0039182464889735424,0.08069976436278248,1.0,0.9832437646842479,0.04522405232466686,-0.17659695439299936,
    0.7166865291132416,0.170734878615723,-0.5568576492754596,1.0,0.19279029454490246,0.9789282671451195,-0.0673153037098054,
    0.8156158714508839,0.19550390787653682,0.08667684517342544,1.0,0.19279029454490246,0.9789282671451195,-0.0673153037098054,
    0.9033680008806482,0.167903084023733,-0.06338513523215128,1.0,0.19279029454490246,0.9789282671451195,-0.0673153037098054,
    0.5049863515477553,0.1682006218780463,-0.4975048300045787,1.0,-0.7814528684441715,0.49944565707112454,0.3740126335208065,
    0.5613047633178101,0.09542748930698397,-0.2826553777773524,1.0,-0.7814528684441715,0.49944565707112454,0.3740126335208065,
    0.6964954348280423,0.16727131463870282,-0.09612945529035077,1.0,-0.7814528684441715,0.49944565707112454,0.3740126335208065,
    0.8687004535657479,-0.1763490111054209,-0.2391279029883011,1.0,0.6966193255193781,-0.6445854470681478,-0.315009708962887,
    0.7754171512625019,-0.10570730252021743,-0.589966513031839,1.0,0.6966193255193781,-0.6445854470681478,-0.315009708962887,
    0.9565403287434329,-0.10661427447827176,-0.18757089457587706,1.0,0.6966193255193781,-0.6445854470681478,-0.315009708962887,
    0.7754171512625019,-0.10570730252021743,-0.589966513031839,1.0,0.7988463273660503,-0.48142714534597725,-0.36065558220800703,
    0.9078087334140592,-0.0039182464889735424,-0.4325961095130749,1.0,0.7988463273660503,-0.48142714534597725,-0.36065558220800703,
    0.9565403287434329,-0.10661427447827176,-0.18757089457587706,1.0,0.7988463273660503,-0.48142714534597725,-0.36065558220800703,
    0.6648519250619407,-0.17640006317693846,-0.23093484319834845,1.0,-0.2574221418430778,-0.950404859794422,0.17454066393842815,
    0.46388544553302347,-0.20334040085448402,-0.6740261418513714,1.0,-0.2574221418430778,-0.950404859794422,0.17454066393842815,
    0.7809108327709628,-0.2030994988920105,-0.20514796326165308,1.0,-0.2574221418430778,-0.950404859794422,0.17454066393842815,
    0.46388544553302347,-0.20334040085448402,-0.6740261418513714,1.0,0.1679109717101201,-0.979301123914871,-0.1130274934625802,
    0.6296275910920519,-0.17647983203868467,-0.6605308458211486,1.0,0.1679109717101201,-0.979301123914871,-0.1130274934625802,
    0.7809108327709628,-0.2030994988920105,-0.20514796326165308,1.0,0.1679109717101201,-0.979301123914871,-0.1130274934625802,
    0.655325927592209,-0.0039182464889735424,-0.7556424504356178,1.0,0.7701190247993351,0.21126348320497512,-0.6019006797688653,
    0.6329994208780636,0.09421580029705923,-0.74976428301354,1.0,0.7701190247993351,0.21126348320497512,-0.6019006797688653,
    0.9078087334140592,-0.0039182464889735424,-0.4325961095130749,1.0,0.7701190247993351,0.21126348320497512,-0.6019006797688653,
    0.5049863515477553,0.1682006218780463,-0.4975048300045787,1.0,-0.494072954867252,0.7758751747714034,0.39231317648300645,
    0.41087504845958356,0.0963272820674812,-0.4738836746642927,1.0,-0.494072954867252,0.7758751747714034,0.39231317648300645,
    0.5613047633178101,0.09542748930698397,-0.2826553777773524,1.0,-0.494072954867252,0.7758751747714034,0.39231317648300645,
    0.41087504845958356,0.0963272820674812,-0.4738836746642927,1.0,-0.7614097150611019,0.24518441876348532,0.6001165275229333,
    0.5409724781473202,-0.00598904613990503,-0.2670174901206265,1.0,-0.7614097150611019,0.24518441876348532,0.6001165275229333,
    0.5613047633178101,0.09542748930698397,-0.2826553777773524,1.0,-0.7614097150611019,0.24518441876348532,0.6001165275229333,
    0.359125797090351,-0.0024552855645483262,-0.48409329127918943,1.0,-0.7378174215544262,-0.28151328974683043,0.6134946781730835,
    0.5588925529386051,-0.10464478128175803,-0.29073596347224284,1.0,-0.7378174215544262,-0.28151328974683043,0.6134946781730835,
    0.5409724781473202,-0.00598904613990503,-0.2670174901206265,1.0,-0.7378174215544262,-0.28151328974683043,0.6134946781730835,
    0.349849476157885,-0.1017068941036453,-0.5249620699062396,1.0,-0.4869011962298285,-0.7630983980227241,0.424980070174019,
    0.4584300530782006,-0.17598047896415348,-0.5339272922778956,1.0,-0.4869011962298285,-0.7630983980227241,0.424980070174019,
    0.5588925529386051,-0.10464478128175803,-0.29073596347224284,1.0,-0.4869011962298285,-0.7630983980227241,0.424980070174019,
    0.7754171512625019,-0.10570730252021743,-0.589966513031839,1.0,0.7858270808904445,-0.07253740353383048,-0.6141775997443844,
    0.655325927592209,-0.0039182464889735424,-0.7556424504356178,1.0,0.7858270808904445,-0.07253740353383048,-0.6141775997443844,
    0.9078087334140592,-0.0039182464889735424,-0.4325961095130749,1.0,0.7858270808904445,-0.07253740353383048,-0.6141775997443844,
    0.48074140370861396,-0.10225809693831156,-0.8526046926425989,1.0,0.6069366305207575,-0.4008811685337253,-0.6862377250247501,
    0.655325927592209,-0.0039182464889735424,-0.7556424504356178,1.0,0.6069366305207575,-0.4008811685337253,-0.6862377250247501,
    0.7754171512625019,-0.10570730252021743,-0.589966513031839,1.0,0.6069366305207575,-0.4008811685337253,-0.6862377250247501,
    0.6329994208780636,0.09421580029705923,-0.74976428301354,1.0,0.3316103720297646,0.8187850925235008,-0.4686422232615869,
    0.2883452906857089,0.167903084023733,-0.8648986696149239,1.0,0.3316103720297646,0.8187850925235008,-0.4686422232615869,
    0.7166865291132416,0.170734878615723,-0.5568576492754596,1.0,0.3316103720297646,0.8187850925235008,-0.4686422232615869,
    0.7166865291132416,0.170734878615723,-0.5568576492754596,1.0,0.13916013694006343,0.9635684794352671,-0.22840805967747696,
    0.11259773679785456,0.19585489086822028,-0.8189334584109087,1.0,0.13916013694006343,0.9635684794352671,-0.22840805967747696,
    0.6335011670184474,0.19526300591406343,-0.5040642235059691,1.0,0.13916013694006343,0.9635684794352671,-0.22840805967747696,
    0.5049863515477553,0.1682006218780463,-0.4975048300045787,1.0,-0.3668360795446961,0.6866232225204635,0.6276781349066506,
    0.16459985545882239,0.09299214595787242,-0.6141667903084023,1.0,-0.3668360795446961,0.6866232225204635,0.6276781349066506,
    0.41087504845958356,0.0963272820674812,-0.4738836746642927,1.0,-0.3668360795446961,0.6866232225204635,0.6276781349066506,
    0.3024101363887999,0.09687369877044283,-0.9264140227277441,1.0,0.3621352354031023,0.6501734571361599,-0.6679315435844856,
    0.2883452906857089,0.167903084023733,-0.8648986696149239,1.0,0.3621352354031023,0.6501734571361599,-0.6679315435844856,
    0.6329994208780636,0.09421580029705923,-0.74976428301354,1.0,0.3621352354031023,0.6501734571361599,-0.6679315435844856,
    0.1781047237524549,0.16935248424166138,-0.6832378500058232,1.0,-0.37010463917585873,0.6583371202691086,0.6554500683776641,
    0.16459985545882239,0.09299214595787242,-0.6141667903084023,1.0,-0.37010463917585873,0.6583371202691086,0.6554500683776641,
    0.5049863515477553,0.1682006218780463,-0.4975048300045787,1.0,-0.37010463917585873,0.6583371202691086,0.6554500683776641,
    0.349849476157885,-0.1017068941036453,-0.5249620699062396,1.0,-0.3554797261346931,-0.6056117680196029,0.7119470139999003,
    0.13273618363430129,-0.17682602889866328,-0.6972675974097455,1.0,-0.3554797261346931,-0.6056117680196029,0.7119470139999003,
    0.4584300530782006,-0.17598047896415348,-0.5339272922778956,1.0,-0.3554797261346931,-0.6056117680196029,0.7119470139999003,
    0.46388544553302347,-0.20334040085448402,-0.6740261418513714,1.0,0.1776166038375554,-0.9185676693282108,-0.35310873524475717,
    0.16008812863845723,-0.17707570543592888,-0.8951629757614337,1.0,0.1776166038375554,-0.9185676693282108,-0.35310873524475717,
    0.6296275910920519,-0.17647983203868467,-0.6605308458211486,1.0,0.1776166038375554,-0.9185676693282108,-0.35310873524475717,
    0.10775895764432986,-0.005864606715580978,-0.59750945659856,1.0,-0.33407723245432347,-0.13809802831724935,0.9323740329559528,
    0.04910092515925846,-0.10320335795000402,-0.6329443803634589,1.0,-0.33407723245432347,-0.13809802831724935,0.9323740329559528,
    0.349849476157885,-0.1017068941036453,-0.5249620699062396,1.0,-0.33407723245432347,-0.13809802831724935,0.9323740329559528,
    0.04910092515925846,-0.10320335795000402,-0.6329443803634589,1.0,-0.2127508664200122,-0.768692321883381,0.6031991239342699,
    0.13273618363430129,-0.17682602889866328,-0.6972675974097455,1.0,-0.2127508664200122,-0.768692321883381,0.6031991239342699,
    0.349849476157885,-0.1017068941036453,-0.5249620699062396,1.0,-0.2127508664200122,-0.768692321883381,0.6031991239342699,
    0.07299409231809917,-0.0039182464889735424,-1.0,1.0,0.22144302540794533,0.1937280594254578,-0.9557365879202399,
    0.3024101363887999,0.09687369877044283,-0.9264140227277441,1.0,0.22144302540794533,0.1937280594254578,-0.9557365879202399,
    0.3792778046332945,-0.0039182464889735424,-0.9290344298361068,1.0,0.22144302540794533,0.1937280594254578,-0.9557365879202399,
    0.13273618363430129,-0.17682602889866328,-0.6972675974097455,1.0,-0.10268255242490006,-0.8858757235907172,0.4524162859360071,
    -0.23468637276627247,-0.2020696828868671,-0.8300891337261153,1.0,-0.10268255242490006,-0.8858757235907172,0.4524162859360071,
    0.46388544553302347,-0.20334040085448402,-0.6740261418513714,1.0,-0.10268255242490006,-0.8858757235907172,0.4524162859360071,
    -0.23468637276627247,-0.2020696828868671,-0.8300891337261153,1.0,0.0351457584195701,-0.9856093231508866,-0.16534520792319524,
    0.16008812863845723,-0.17707570543592888,-0.8951629757614337,1.0,0.0351457584195701,-0.9856093231508866,-0.16534520792319524,
    0.46388544553302347,-0.20334040085448402,-0.6740261418513714,1.0,0.0351457584195701,-0.9856093231508866,-0.16534520792319524,
    0.11205451084936291,-0.10232270971632595,-0.9730125986940241,1.0,0.22224241477039952,-0.17484039232288248,-0.9591867108594666,
    0.07299409231809917,-0.0039182464889735424,-1.0,1.0,0.22224241477039952,-0.17484039232288248,-0.9591867108594666,
    0.3792778046332945,-0.0039182464889735424,-0.9290344298361068,1.0,0.22224241477039952,-0.17484039232288248,-0.9591867108594666,
    -0.13415527168476626,0.16935487730751375,-0.8961616819104962,1.0,0.03422850637437451,0.9066587399044608,-0.4204739453357778,
    0.11259773679785456,0.19585489086822028,-0.8189334584109087,1.0,0.03422850637437451,0.9066587399044608,-0.4204739453357778,
    0.2883452906857089,0.167903084023733,-0.8648986696149239,1.0,0.03422850637437451,0.9066587399044608,-0.4204739453357778,
    0.11259773679785456,0.19585489086822028,-0.8189334584109087,1.0,-0.003419416504511889,0.9811387179674791,0.19327473631051803,
    -0.23240019718862626,0.1666937880796604,-0.6770039134603573,1.0,-0.003419416504511889,0.9811387179674791,0.19327473631051803,
    0.1781047237524549,0.16935248424166138,-0.6832378500058232,1.0,-0.003419416504511889,0.9811387179674791,0.19327473631051803,
    -0.30992436316529226,-0.0039182464889735424,-0.9637992951623375,1.0,-0.09405062838392744,0.03818609656357124,-0.9948348110766059,
    -0.08094146401387337,0.09421580029705923,-0.9816802832113667,1.0,-0.09405062838392744,0.03818609656357124,-0.9948348110766059,
    0.07299409231809917,-0.0039182464889735424,-1.0,1.0,-0.09405062838392744,0.03818609656357124,-0.9948348110766059,
    -0.23240019718862626,0.1666937880796604,-0.6770039134603573,1.0,0.03831831148635292,0.7597785085066877,0.649051866198833,
    -0.24744141375949047,0.09469600884477147,-0.5918354974625525,1.0,0.03831831148635292,0.7597785085066877,0.649051866198833,
    0.16459985545882239,0.09299214595787242,-0.6141667903084023,1.0,0.03831831148635292,0.7597785085066877,0.649051866198833,
    -0.24744141375949047,0.09469600884477147,-0.5918354974625525,1.0,0.05417673396804891,0.13554422698128907,0.9892889588126413,
    0.10775895764432986,-0.005864606715580978,-0.59750945659856,1.0,0.05417673396804891,0.13554422698128907,0.9892889588126413,
    0.16459985545882239,0.09299214595787242,-0.6141667903084023,1.0,0.05417673396804891,0.13554422698128907,0.9892889588126413,
    -0.15405361424735686,-0.0025398405579991623,-0.5860658156924496,1.0,0.03614639146527331,-0.3610139861154059,0.9318596140047624,
    0.04910092515925846,-0.10320335795000402,-0.6329443803634589,1.0,0.03614639146527331,-0.3610139861154059,0.9318596140047624,
    0.10775895764432986,-0.005864606715580978,-0.59750945659856,1.0,0.03614639146527331,-0.3610139861154059,0.9318596140047624,
    0.16008812863845723,-0.17707570543592888,-0.8951629757614337,1.0,-0.06189860866358575,-0.7387297080427262,-0.6711534703036414,
    -0.32437289709338224,-0.10466073505410722,-0.9301886852655744,1.0,-0.06189860866358575,-0.7387297080427262,-0.6711534703036414,
    0.11205451084936291,-0.10232270971632595,-0.9730125986940241,1.0,-0.06189860866358575,-0.7387297080427262,-0.6711534703036414,
    0.11205451084936291,-0.10232270971632595,-0.9730125986940241,1.0,-0.08988874801974124,-0.29644015304294463,-0.9508118891996034,
    -0.30992436316529226,-0.0039182464889735424,-0.9637992951623375,1.0,-0.08988874801974124,-0.29644015304294463,-0.9508118891996034,
    0.07299409231809917,-0.0039182464889735424,-1.0,1.0,-0.08988874801974124,-0.29644015304294463,-0.9508118891996034,
    -0.15405361424735686,-0.0025398405579991623,-0.5860658156924496,1.0,0.1820242970833086,-0.08869587692776221,0.9792855542115092,
    -0.28361818793862903,-0.1031243867768753,-0.571093200342687,1.0,0.1820242970833086,-0.08869587692776221,0.9792855542115092,
    0.04910092515925846,-0.10320335795000402,-0.6329443803634589,1.0,0.1820242970833086,-0.08869587692776221,0.9792855542115092,
    -0.28361818793862903,-0.1031243867768753,-0.571093200342687,1.0,0.11544493039066807,-0.77445413515605,0.6220074441570521,
    -0.1957487982820978,-0.17682762427589815,-0.6791688403681493,1.0,0.11544493039066807,-0.77445413515605,0.6220074441570521,
    0.04910092515925846,-0.10320335795000402,-0.6329443803634589,1.0,0.11544493039066807,-0.77445413515605,0.6220074441570521,
    -0.5411431835114573,0.09877857918894217,-0.8209851135350208,1.0,-0.2455402468540986,0.6473456374087714,-0.721563311777047,
    -0.13415527168476626,0.16935487730751375,-0.8961616819104962,1.0,-0.2455402468540986,0.6473456374087714,-0.721563311777047,
    -0.08094146401387337,0.09421580029705923,-0.9816802832113667,1.0,-0.2455402468540986,0.6473456374087714,-0.721563311777047,
    -0.13415527168476626,0.16935487730751375,-0.8961616819104962,1.0,-0.05216320791701877,0.9838985157913634,-0.17094651316525275,
    -0.5377099317019006,0.1951928093157269,-0.6243070080135799,1.0,-0.05216320791701877,0.9838985157913634,-0.17094651316525275,
    0.11259773679785456,0.19585489086822028,-0.8189334584109087,1.0,-0.05216320791701877,0.9838985157913634,-0.17094651316525275,
    -0.5377099317019006,0.1951928093157269,-0.6243070080135799,1.0,0.17521285056553765,0.7895615408731582,0.588126712682482,
    -0.23240019718862626,0.1666937880796604,-0.6770039134603573,1.0,0.17521285056553765,0.7895615408731582,0.588126712682482,
    0.11259773679785456,0.19585489086822028,-0.8189334584109087,1.0,0.17521285056553765,0.7895615408731582,0.588126712682482,
    -0.24744141375949047,0.09469600884477147,-0.5918354974625525,1.0,0.40596165162057957,0.43750567227141307,0.8023614672601309,
    -0.4032268099953574,-0.0039182464889735424,-0.4592428977793944,1.0,0.40596165162057957,0.43750567227141307,0.8023614672601309,
    -0.15405361424735686,-0.0025398405579991623,-0.5860658156924496,1.0,0.40596165162057957,0.43750567227141307,0.8023614672601309,
    -0.4032268099953574,-0.0039182464889735424,-0.4592428977793944,1.0,0.41478980563893125,-0.41365626581720577,0.810455372545696,
    -0.28361818793862903,-0.1031243867768753,-0.571093200342687,1.0,0.41478980563893125,-0.41365626581720577,0.810455372545696,
    -0.15405361424735686,-0.0025398405579991623,-0.5860658156924496,1.0,0.41478980563893125,-0.41365626581720577,0.810455372545696,
    -0.4662665460561477,-0.17598047896415348,-0.5339272922778956,1.0,0.0978931301350879,-0.9772726214280525,0.18802967446522112,
    -0.4162578512502174,-0.20359486352345446,-0.7034871755600971,1.0,0.0978931301350879,-0.9772726214280525,0.18802967446522112,
    -0.1957487982820978,-0.17682762427589815,-0.6791688403681493,1.0,0.0978931301350879,-0.9772726214280525,0.18802967446522112,
    -0.663162420570156,-0.0039182464889735424,-0.7556416527470003,1.0,-0.5069242163909425,0.05495434994504902,-0.8602370942121399,
    -0.5411431835114573,0.09877857918894217,-0.8209851135350208,1.0,-0.5069242163909425,0.05495434994504902,-0.8602370942121399,
    -0.30992436316529226,-0.0039182464889735424,-0.9637992951623375,1.0,-0.5069242163909425,0.05495434994504902,-0.8602370942121399,
    -0.5204623084151363,-0.17635220185989076,-0.7493805947885408,1.0,-0.48320784168391856,-0.4966812010992074,-0.7209840263208457,
    -0.7343098637388303,-0.10661427447827176,-0.6541006778757872,1.0,-0.48320784168391856,-0.4966812010992074,-0.7209840263208457,
    -0.32437289709338224,-0.10466073505410722,-0.9301886852655744,1.0,-0.48320784168391856,-0.4966812010992074,-0.7209840263208457,
    -0.32437289709338224,-0.10466073505410722,-0.9301886852655744,1.0,-0.4963877569492358,-0.20984251471836013,-0.8423569990019559,
    -0.663162420570156,-0.0039182464889735424,-0.7556416527470003,1.0,-0.4963877569492358,-0.20984251471836013,-0.8423569990019559,
    -0.30992436316529226,-0.0039182464889735424,-0.9637992951623375,1.0,-0.4963877569492358,-0.20984251471836013,-0.8423569990019559,
    -0.6390490913528959,0.16780975445548973,-0.32973495997996205,1.0,0.5173912366733407,0.6062972297402823,0.6039122265883433,
    -0.24744141375949047,0.09469600884477147,-0.5918354974625525,1.0,0.5173912366733407,0.6062972297402823,0.6039122265883433,
    -0.23240019718862626,0.1666937880796604,-0.6770039134603573,1.0,0.5173912366733407,0.6062972297402823,0.6039122265883433,
    -0.663162420570156,-0.0039182464889735424,-0.7556416527470003,1.0,-0.6702887253969206,0.3977905233853815,-0.626478829738528,
    -0.8498989328521676,0.09608957085947756,-0.49234538002683426,1.0,-0.6702887253969206,0.3977905233853815,-0.626478829738528,
    -0.5411431835114573,0.09877857918894217,-0.8209851135350208,1.0,-0.6702887253969206,0.3977905233853815,-0.626478829738528,
    -0.8498989328521676,0.09608957085947756,-0.49234538002683426,1.0,-0.539707068923729,0.6761610684693745,-0.5015201782980534,
    -0.802130945372688,0.16864333906073758,-0.4459318678198053,1.0,-0.539707068923729,0.6761610684693745,-0.5015201782980534,
    -0.5411431835114573,0.09877857918894217,-0.8209851135350208,1.0,-0.539707068923729,0.6761610684693745,-0.5015201782980534,
    -0.4162578512502174,-0.20359486352345446,-0.7034871755600971,1.0,-0.18081532735517644,-0.9695786638998125,-0.16499403596401524,
    -0.7835527774719971,-0.17754713940884892,-0.45404037261630703,1.0,-0.18081532735517644,-0.9695786638998125,-0.16499403596401524,
    -0.5204623084151363,-0.17635220185989076,-0.7493805947885408,1.0,-0.18081532735517644,-0.9695786638998125,-0.16499403596401524,
    -0.5337151071056507,-0.10464478128175803,-0.34791747432639186,1.0,0.6743505238163042,-0.5739134134717244,0.46462325045773334,
    -0.6671484705916138,-0.17643516147610672,-0.2429304846277427,1.0,0.6743505238163042,-0.5739134134717244,0.46462325045773334,
    -0.4662665460561477,-0.17598047896415348,-0.5339272922778956,1.0,0.6743505238163042,-0.5739134134717244,0.46462325045773334,
    -0.6671484705916138,-0.17643516147610672,-0.2429304846277427,1.0,0.19159051534563673,-0.9727282492954014,0.13073954050820583,
    -0.7298659404509493,-0.2035270599909702,-0.3525911319361019,1.0,0.19159051534563673,-0.9727282492954014,0.13073954050820583,
    -0.4662665460561477,-0.17598047896415348,-0.5339272922778956,1.0,0.19159051534563673,-0.9727282492954014,0.13073954050820583,
    -0.802130945372688,0.16864333906073758,-0.4459318678198053,1.0,-0.15069467631354327,0.9856011905307258,-0.07669033677832067,
    -0.8177417116164203,0.19579905266499775,-0.06626000500948448,1.0,-0.15069467631354327,0.9856011905307258,-0.07669033677832067,
    -0.5377099317019006,0.1951928093157269,-0.6243070080135799,1.0,-0.15069467631354327,0.9856011905307258,-0.07669033677832067,
    -0.7835527774719971,-0.17754713940884892,-0.45404037261630703,1.0,-0.7477567396858517,-0.5460961757135327,-0.377675555371856,
    -0.9665481301381118,-0.1020211834189253,-0.20093536967283598,1.0,-0.7477567396858517,-0.5460961757135327,-0.377675555371856,
    -0.7343098637388303,-0.10661427447827176,-0.6541006778757872,1.0,-0.7477567396858517,-0.5460961757135327,-0.377675555371856,
    -0.9665481301381118,-0.1020211834189253,-0.20093536967283598,1.0,-0.7688747315296425,-0.5075402190961794,-0.38888889572090163,
    -0.9059612865760174,-0.0039182464889735424,-0.44875648321423844,1.0,-0.7688747315296425,-0.5075402190961794,-0.38888889572090163,
    -0.7343098637388303,-0.10661427447827176,-0.6541006778757872,1.0,-0.7688747315296425,-0.5075402190961794,-0.38888889572090163,
    -0.6390490913528959,0.16780975445548973,-0.32973495997996205,1.0,0.5710367023659148,0.8000251444201971,0.18405665662101078,
    -0.6363967766998345,0.09095803998334406,-0.0039182464889735424,1.0,0.5710367023659148,0.8000251444201971,0.18405665662101078,
    -0.5337151071056507,0.09680828830381083,-0.34791747432639186,1.0,0.5710367023659148,0.8000251444201971,0.18405665662101078,
    -0.6320398014712569,-0.1017068941036453,-0.049768590532074275,1.0,0.5813641445402496,-0.788807064243872,0.19949723517369275,
    -0.6671484705916138,-0.17643516147610672,-0.2429304846277427,1.0,0.5813641445402496,-0.788807064243872,0.19949723517369275,
    -0.5337151071056507,-0.10464478128175803,-0.34791747432639186,1.0,0.5813641445402496,-0.788807064243872,0.19949723517369275,
    -0.9072423744956615,-0.17707570543592888,-0.07617048839283291,1.0,-0.5893511161994591,-0.7847458343942014,-0.19193550280081156,
    -0.9665481301381118,-0.1020211834189253,-0.20093536967283598,1.0,-0.5893511161994591,-0.7847458343942014,-0.19193550280081156,
    -0.7835527774719971,-0.17754713940884892,-0.45404037261630703,1.0,-0.5893511161994591,-0.7847458343942014,-0.19193550280081156,
    -1.0,-0.0039182464889735424,-0.08083058529604625,1.0,-0.955556061374656,0.16511621373348595,-0.2442319584584962,
    -0.9730125986940241,0.09448621673837887,-0.11989100382731,1.0,-0.955556061374656,0.16511621373348595,-0.2442319584584962,
    -0.9059612865760174,-0.0039182464889735424,-0.44875648321423844,1.0,-0.955556061374656,0.16511621373348595,-0.2442319584584962,
    -0.9011113397818481,0.170042484895766,0.18936489627654907,1.0,-0.5155440062880179,0.8529111066778041,-0.08220110513943026,
    -0.8177417116164203,0.19579905266499775,-0.06626000500948448,1.0,-0.5155440062880179,0.8529111066778041,-0.08220110513943026,
    -0.802130945372688,0.16864333906073758,-0.4459318678198053,1.0,-0.5155440062880179,0.8529111066778041,-0.08220110513943026,
    -0.6671484705916138,-0.17643516147610672,-0.2429304846277427,1.0,0.31466887113580105,-0.9476554534368313,0.05415388360546495,
    -0.8080314480760549,-0.20308593818551368,0.10932003426870307,1.0,0.31466887113580105,-0.9476554534368313,0.05415388360546495,
    -0.7298659404509493,-0.2035270599909702,-0.3525911319361019,1.0,0.31466887113580105,-0.9476554534368313,0.05415388360546495,
    -0.9665481301381118,-0.1020211834189253,-0.20093536967283598,1.0,-0.9684962604433305,-0.027189288810588894,-0.24753936269058135,
    -1.0,-0.0039182464889735424,-0.08083058529604625,1.0,-0.9684962604433305,-0.027189288810588894,-0.24753936269058135,
    -0.9059612865760174,-0.0039182464889735424,-0.44875648321423844,1.0,-0.9684962604433305,-0.027189288810588894,-0.24753936269058135,
    -0.6905845621726485,0.16885392885574757,0.1814701720295273,1.0,0.9054736307787169,0.41465521036015185,0.09043539398701157,
    -0.6363967766998345,0.09095803998334406,-0.0039182464889735424,1.0,0.9054736307787169,0.41465521036015185,0.09043539398701157,
    -0.6390490913528959,0.16780975445548973,-0.32973495997996205,1.0,0.9054736307787169,0.41465521036015185,0.09043539398701157,
    -0.6320398014712569,-0.1017068941036453,-0.049768590532074275,1.0,0.8501419437225839,-0.5243311371594281,0.04832736418105259,
    -0.6912833374015452,-0.17669042183369466,0.17886412331627888,1.0,0.8501419437225839,-0.5243311371594281,0.04832736418105259,
    -0.6671484705916138,-0.17643516147610672,-0.2429304846277427,1.0,0.8501419437225839,-0.5243311371594281,0.04832736418105259,
    -0.6912833374015452,-0.17669042183369466,0.17886412331627888,1.0,0.21390233311942286,-0.9767856008986079,0.011648251508826287,
    -0.8080314480760549,-0.20308593818551368,0.10932003426870307,1.0,0.21390233311942286,-0.9767856008986079,0.011648251508826287,
    -0.6671484705916138,-0.17643516147610672,-0.2429304846277427,1.0,0.21390233311942286,-0.9767856008986079,0.011648251508826287,
    -0.976441064371876,-0.0039182464889735424,0.23958497856610683,1.0,-0.9545570777114526,0.28964609246008666,0.07018494506355814,
    -0.9730125986940241,0.09448621673837887,-0.11989100382731,1.0,-0.9545570777114526,0.28964609246008666,0.07018494506355814,
    -1.0,-0.0039182464889735424,-0.08083058529604625,1.0,-0.9545570777114526,0.28964609246008666,0.07018494506355814,
    -0.9301886852655744,0.09682424207616003,0.31653640411543504,1.0,-0.8686589911375658,0.48847273475734065,0.08261927447364174,
    -0.9011113397818481,0.170042484895766,0.18936489627654907,1.0,-0.8686589911375658,0.48847273475734065,0.08261927447364174,
    -0.9730125986940241,0.09448621673837887,-0.11989100382731,1.0,-0.8686589911375658,0.48847273475734065,0.08261927447364174,
    -0.5860658156924496,-0.0025398405579991623,0.14621791895802705,1.0,0.9178551675711154,-0.3966465234117265,-0.014609135100693199,
    -0.6320398014712569,-0.1017068941036453,-0.049768590532074275,1.0,0.9178551675711154,-0.3966465234117265,-0.014609135100693199,
    -0.5925398565117715,-0.006432561011213922,-0.1548401352241744,1.0,0.9178551675711154,-0.3966465234117265,-0.014609135100693199,
    -0.9072423744956615,-0.17707570543592888,-0.07617048839283291,1.0,-0.8122196974578637,-0.5822510553944408,0.03581719633801805,
    -0.9449539015747969,-0.10419727796736178,0.25337781245064295,1.0,-0.8122196974578637,-0.5822510553944408,0.03581719633801805,
    -0.9665481301381118,-0.1020211834189253,-0.20093536967283598,1.0,-0.8122196974578637,-0.5822510553944408,0.03581719633801805,
    -0.9665481301381118,-0.1020211834189253,-0.20093536967283598,1.0,-0.9162481112873995,-0.3949062164394564,0.06736823271948328,
    -0.976441064371876,-0.0039182464889735424,0.23958497856610683,1.0,-0.9162481112873995,-0.3949062164394564,0.06736823271948328,
    -1.0,-0.0039182464889735424,-0.08083058529604625,1.0,-0.9162481112873995,-0.3949062164394564,0.06736823271948328,
    -0.5860658156924496,-0.0025398405579991623,0.14621791895802705,1.0,0.9741594809247878,-0.17874256902629715,-0.13807389232663525,
    -0.5973339651027183,-0.10358066466606353,0.197518869324246,1.0,0.9741594809247878,-0.17874256902629715,-0.13807389232663525,
    -0.6320398014712569,-0.1017068941036453,-0.049768590532074275,1.0,0.9741594809247878,-0.17874256902629715,-0.13807389232663525,
    -0.5973339651027183,-0.10358066466606353,0.197518869324246,1.0,0.6229340494986303,-0.7766892031483378,-0.09331158388987866,
    -0.6912833374015452,-0.17669042183369466,0.17886412331627888,1.0,0.6229340494986303,-0.7766892031483378,-0.09331158388987866,
    -0.6320398014712569,-0.1017068941036453,-0.049768590532074275,1.0,0.6229340494986303,-0.7766892031483378,-0.09331158388987866,
    -0.8393104141439764,-0.17589512628208515,0.34211189656850305,1.0,-0.6159889224808048,-0.7810912323028502,0.10224546053763008,
    -0.9449539015747969,-0.10419727796736178,0.25337781245064295,1.0,-0.6159889224808048,-0.7810912323028502,0.10224546053763008,
    -0.9072423744956615,-0.17707570543592888,-0.07617048839283291,1.0,-0.6159889224808048,-0.7810912323028502,0.10224546053763008,
    -0.9011113397818481,0.170042484895766,0.18936489627654907,1.0,-0.15306609379250127,0.9869741514026201,0.04952570437846444,
    -0.6292183768312936,0.19550390787653682,0.522279443085715,1.0,-0.15306609379250127,0.9869741514026201,0.04952570437846444,
    -0.8177417116164203,0.19579905266499775,-0.06626000500948448,1.0,-0.15306609379250127,0.9869741514026201,0.04952570437846444,
    -0.6292183768312936,0.19550390787653682,0.522279443085715,1.0,0.4834430932613378,0.8616468422510648,-0.15442634107132766,
    -0.6905845621726485,0.16885392885574757,0.1814701720295273,1.0,0.4834430932613378,0.8616468422510648,-0.15442634107132766,
    -0.8177417116164203,0.19579905266499775,-0.06626000500948448,1.0,0.4834430932613378,0.8616468422510648,-0.15442634107132766,
    -0.5337151071056507,0.09680828830381083,0.3400809813484449,1.0,0.9565192690188564,0.05493302822370786,-0.2864493854170502,
    -0.5860658156924496,-0.0025398405579991623,0.14621791895802705,1.0,0.9565192690188564,0.05493302822370786,-0.2864493854170502,
    -0.6363967766998345,0.09095803998334406,-0.0039182464889735424,1.0,0.9565192690188564,0.05493302822370786,-0.2864493854170502,
    -0.8415662775541591,-0.060115409589174384,0.5388003720419712,1.0,-0.9014419112601229,0.09050513189483261,0.4233335584670743,
    -0.9301886852655744,0.09682424207616003,0.31653640411543504,1.0,-0.9014419112601229,0.09050513189483261,0.4233335584670743,
    -0.976441064371876,-0.0039182464889735424,0.23958497856610683,1.0,-0.9014419112601229,0.09050513189483261,0.4233335584670743,
    -0.5337151071056507,0.09680828830381083,0.3400809813484449,1.0,0.8250003210024492,0.38054836803102254,-0.4178006820659599,
    -0.4592428977793944,-0.0039182464889735424,0.39539031701741045,1.0,0.8250003210024492,0.38054836803102254,-0.4178006820659599,
    -0.5860658156924496,-0.0025398405579991623,0.14621791895802705,1.0,0.8250003210024492,0.38054836803102254,-0.4178006820659599,
    -0.4592428977793944,-0.0039182464889735424,0.39539031701741045,1.0,0.8455231130429283,-0.31367459055954683,-0.4320867002668516,
    -0.5973339651027183,-0.10358066466606353,0.197518869324246,1.0,0.8455231130429283,-0.31367459055954683,-0.4320867002668516,
    -0.5860658156924496,-0.0025398405579991623,0.14621791895802705,1.0,0.8455231130429283,-0.31367459055954683,-0.4320867002668516,
    -0.8393104141439764,-0.17589512628208515,0.34211189656850305,1.0,-0.7096136455033547,-0.6107301859621318,0.3513646454470044,
    -0.8415662775541591,-0.060115409589174384,0.5388003720419712,1.0,-0.7096136455033547,-0.6107301859621318,0.3513646454470044,
    -0.9449539015747969,-0.10419727796736178,0.25337781245064295,1.0,-0.7096136455033547,-0.6107301859621318,0.3513646454470044,
    -0.9449539015747969,-0.10419727796736178,0.25337781245064295,1.0,-0.9021606733335233,-0.23336921651432804,0.36282906205800625,
    -0.8415662775541591,-0.060115409589174384,0.5388003720419712,1.0,-0.9021606733335233,-0.23336921651432804,0.36282906205800625,
    -0.976441064371876,-0.0039182464889735424,0.23958497856610683,1.0,-0.9021606733335233,-0.23336921651432804,0.36282906205800625,
    -0.6972580251463361,0.09773919092038907,0.6800638469969416,1.0,-0.5222698324647073,0.7852169882032165,0.3326687594805925,
    -0.9011113397818481,0.170042484895766,0.18936489627654907,1.0,-0.5222698324647073,0.7852169882032165,0.3326687594805925,
    -0.9301886852655744,0.09682424207616003,0.31653640411543504,1.0,-0.5222698324647073,0.7852169882032165,0.3326687594805925,
    -0.632499270114915,0.16935487730751375,0.6425684935331382,1.0,-0.3226673731334063,0.9266994350332732,0.19264974286045428,
    -0.6292183768312936,0.19550390787653682,0.522279443085715,1.0,-0.3226673731334063,0.9266994350332732,0.19264974286045428,
    -0.9011113397818481,0.170042484895766,0.18936489627654907,1.0,-0.3226673731334063,0.9266994350332732,0.19264974286045428,
    -0.38954964096035327,-0.17506154167683707,0.5960441026082823,1.0,0.1980699680492919,-0.9702146435970882,-0.13946982866099625,
    -0.45812852678079996,-0.20293278197096098,0.6925357085309607,1.0,0.1980699680492919,-0.9702146435970882,-0.13946982866099625,
    -0.6912833374015452,-0.17669042183369466,0.17886412331627888,1.0,0.1980699680492919,-0.9702146435970882,-0.13946982866099625,
    -0.45812852678079996,-0.20293278197096098,0.6925357085309607,1.0,-0.1867765926119505,-0.9740256404611157,0.1280177963276311,
    -0.5997772853380046,-0.17800581036388963,0.6755289872066701,1.0,-0.1867765926119505,-0.9740256404611157,0.1280177963276311,
    -0.8393104141439764,-0.17589512628208515,0.34211189656850305,1.0,-0.1867765926119505,-0.9740256404611157,0.1280177963276311,
    -0.5646869630558493,-0.0039182464889735424,0.8353307456314583,1.0,-0.7356849897247713,0.0696286681390021,0.6737354410054823,
    -0.6972580251463361,0.09773919092038907,0.6800638469969416,1.0,-0.7356849897247713,0.0696286681390021,0.6737354410054823,
    -0.8415662775541591,-0.060115409589174384,0.5388003720419712,1.0,-0.7356849897247713,0.0696286681390021,0.6737354410054823,
    -0.4662665460561477,0.1681439859862064,0.5260907992999484,1.0,0.41380920783883657,0.7897070556616166,-0.4529069504280707,
    -0.29361960782436813,0.09536686497205693,0.5569366204485882,1.0,0.41380920783883657,0.7897070556616166,-0.4529069504280707,
    -0.5337151071056507,0.09680828830381083,0.3400809813484449,1.0,0.41380920783883657,0.7897070556616166,-0.4529069504280707,
    -0.29361960782436813,0.09536686497205693,0.5569366204485882,1.0,0.6679634504383165,0.08809223921883787,-0.738961830048041,
    -0.4592428977793944,-0.0039182464889735424,0.39539031701741045,1.0,0.6679634504383165,0.08809223921883787,-0.738961830048041,
    -0.5337151071056507,0.09680828830381083,0.3400809813484449,1.0,0.6679634504383165,0.08809223921883787,-0.738961830048041,
    -0.5646869630558493,-0.0039182464889735424,0.8353307456314583,1.0,-0.5029949142156375,0.46082746736361485,0.7311868171653809,
    -0.3920280594948078,0.09604968642860445,0.8911011453213169,1.0,-0.5029949142156375,0.46082746736361485,0.7311868171653809,
    -0.6972580251463361,0.09773919092038907,0.6800638469969416,1.0,-0.5029949142156375,0.46082746736361485,0.7311868171653809,
    -0.3920280594948078,0.09604968642860445,0.8911011453213169,1.0,-0.4111862884359558,0.6860617373490878,0.6002042391951378,
    -0.632499270114915,0.16935487730751375,0.6425684935331382,1.0,-0.4111862884359558,0.6860617373490878,0.6002042391951378,
    -0.6972580251463361,0.09773919092038907,0.6800638469969416,1.0,-0.4111862884359558,0.6860617373490878,0.6002042391951378,
    -0.4592428977793944,-0.0039182464889735424,0.39539031701741045,1.0,0.5672488325964062,-0.23451397990883094,-0.7894504133543377,
    -0.2538811539682615,-0.10346340443929669,0.572521062967944,1.0,0.5672488325964062,-0.23451397990883094,-0.7894504133543377,
    -0.4777397014411042,-0.10326398228493117,0.4116113150535008,1.0,0.5672488325964062,-0.23451397990883094,-0.7894504133543377,
    -0.2538811539682615,-0.10346340443929669,0.572521062967944,1.0,0.34340826104173316,-0.8080015038545257,-0.4787528966148588,
    -0.38954964096035327,-0.17506154167683707,0.5960441026082823,1.0,0.34340826104173316,-0.8080015038545257,-0.4787528966148588,
    -0.4777397014411042,-0.10326398228493117,0.4116113150535008,1.0,0.34340826104173316,-0.8080015038545257,-0.4787528966148588,
    -0.28088052060349933,0.16851570888194356,0.8596921560087487,1.0,-0.121379178059017,0.9716212630276706,0.20302516190421255,
    -0.21178313718170227,0.19550390787653682,0.7718443039448895,1.0,-0.121379178059017,0.9716212630276706,0.20302516190421255,
    -0.6292183768312936,0.19550390787653682,0.522279443085715,1.0,-0.121379178059017,0.9716212630276706,0.20302516190421255,
    -0.21178313718170227,0.19550390787653682,0.7718443039448895,1.0,0.1654106623546269,0.9466205785172737,-0.2766745255838086,
    -0.4662665460561477,0.1681439859862064,0.5260907992999484,1.0,0.1654106623546269,0.9466205785172737,-0.2766745255838086,
    -0.6292183768312936,0.19550390787653682,0.522279443085715,1.0,0.1654106623546269,0.9466205785172737,-0.2766745255838086,
    -0.15133987757075107,0.16843434464296259,0.6853214126746341,1.0,0.3708212116262619,0.5683999241865358,-0.734447516976381,
    -0.29361960782436813,0.09536686497205693,0.5569366204485882,1.0,0.3708212116262619,0.5683999241865358,-0.734447516976381,
    -0.4662665460561477,0.1681439859862064,0.5260907992999484,1.0,0.3708212116262619,0.5683999241865358,-0.734447516976381,
    -0.1233856776604112,-0.1757523400195593,0.9035283362927582,1.0,-0.2548293130228733,-0.8019068816903577,0.5403770667986727,
    -0.5475526115527647,-0.10419648027874429,0.8096882473345235,1.0,-0.2548293130228733,-0.8019068816903577,0.5403770667986727,
    -0.5997772853380046,-0.17800581036388963,0.6755289872066701,1.0,-0.2548293130228733,-0.8019068816903577,0.5403770667986727,
    -0.1233856776604112,-0.1757523400195593,0.9035283362927582,1.0,-0.26473595353717616,-0.7013479028308464,0.6618353224930926,
    -0.20465259863020913,-0.10370191333591794,0.9473732911515593,1.0,-0.26473595353717616,-0.7013479028308464,0.6618353224930926,
    -0.5475526115527647,-0.10419648027874429,0.8096882473345235,1.0,-0.26473595353717616,-0.7013479028308464,0.6618353224930926,
    -0.20465259863020913,-0.10370191333591794,0.9473732911515593,1.0,-0.3564501934818293,-0.2881745275377688,0.888762454902968,
    -0.5646869630558493,-0.0039182464889735424,0.8353307456314583,1.0,-0.3564501934818293,-0.2881745275377688,0.888762454902968,
    -0.5475526115527647,-0.10419648027874429,0.8096882473345235,1.0,-0.3564501934818293,-0.2881745275377688,0.888762454902968,
    -0.12536155236586477,-0.006215589707264213,0.9906885807683656,1.0,-0.16890800963605668,0.4253851504311432,0.8891105432247778,
    0.054924849755348726,0.09418469044097821,0.9769029260813866,1.0,-0.16890800963605668,0.4253851504311432,0.8891105432247778,
    -0.3920280594948078,0.09604968642860445,0.8911011453213169,1.0,-0.16890800963605668,0.4253851504311432,0.8891105432247778,
    0.054924849755348726,0.09418469044097821,0.9769029260813866,1.0,-0.15134214332717388,0.5792842265592079,0.800952770463301,
    -0.28088052060349933,0.16851570888194356,0.8596921560087487,1.0,-0.15134214332717388,0.5792842265592079,0.800952770463301,
    -0.3920280594948078,0.09604968642860445,0.8911011453213169,1.0,-0.15134214332717388,0.5792842265592079,0.800952770463301,
    -0.15133987757075107,0.16843434464296259,0.6853214126746341,1.0,0.1454440711590127,0.7819069240702745,-0.6061910460041899,
    -0.014260279414368915,0.0956269114613495,0.6242990311274053,1.0,0.1454440711590127,0.7819069240702745,-0.6061910460041899,
    -0.29361960782436813,0.09536686497205693,0.5569366204485882,1.0,0.1454440711590127,0.7819069240702745,-0.6061910460041899,
    -0.014260279414368915,0.0956269114613495,0.6242990311274053,1.0,0.230720331601687,0.17314472673348832,-0.9574910089342841,
    -0.22493383172918147,-0.0039182464889735424,0.5555334861704724,1.0,0.230720331601687,0.17314472673348832,-0.9574910089342841,
    -0.29361960782436813,0.09536686497205693,0.5569366204485882,1.0,0.230720331601687,0.17314472673348832,-0.9574910089342841,
    -0.22493383172918147,-0.0039182464889735424,0.5555334861704724,1.0,0.1831665485224748,-0.21689489816776145,-0.9588569333592788,
    0.033979939726648034,-0.10466472349719458,0.6277817396312446,1.0,0.1831665485224748,-0.21689489816776145,-0.9588569333592788,
    -0.2538811539682615,-0.10346340443929669,0.572521062967944,1.0,0.1831665485224748,-0.21689489816776145,-0.9588569333592788,
    0.033979939726648034,-0.10466472349719458,0.6277817396312446,1.0,0.15401537492350476,-0.5594193006163906,-0.8144503117962696,
    -0.38954964096035327,-0.17506154167683707,0.5960441026082823,1.0,0.15401537492350476,-0.5594193006163906,-0.8144503117962696,
    -0.2538811539682615,-0.10346340443929669,0.572521062967944,1.0,0.15401537492350476,-0.5594193006163906,-0.8144503117962696,
    0.24542166618007655,0.16953914337814746,0.8728245037180267,1.0,-0.00902788660693801,0.9578395044421439,0.2871619421048693,
    -0.21178313718170227,0.19550390787653682,0.7718443039448895,1.0,-0.00902788660693801,0.9578395044421439,0.2871619421048693,
    -0.28088052060349933,0.16851570888194356,0.8596921560087487,1.0,-0.00902788660693801,0.9578395044421439,0.2871619421048693,
    0.20601345541159932,-0.20383975392901532,0.779556357498512,1.0,-0.022718282100055817,-0.9863469801954047,0.1631058377797312,
    -0.1233856776604112,-0.1757523400195593,0.9035283362927582,1.0,-0.022718282100055817,-0.9863469801954047,0.1631058377797312,
    -0.45812852678079996,-0.20293278197096098,0.6925357085309607,1.0,-0.022718282100055817,-0.9863469801954047,0.1631058377797312,
    -0.1233856776604112,-0.1757523400195593,0.9035283362927582,1.0,-0.044373349286242085,-0.5553809411281515,0.830411353549992,
    0.11907018223994137,-0.10225809693831156,0.9656371697369701,1.0,-0.044373349286242085,-0.5553809411281515,0.830411353549992,
    -0.20465259863020913,-0.10370191333591794,0.9473732911515593,1.0,-0.044373349286242085,-0.5553809411281515,0.830411353549992,
    0.11907018223994137,-0.10225809693831156,0.9656371697369701,1.0,-0.05066398570839683,-0.37082115507207336,0.927321320526576,
    -0.12536155236586477,-0.006215589707264213,0.9906885807683656,1.0,-0.05066398570839683,-0.37082115507207336,0.927321320526576,
    -0.20465259863020913,-0.10370191333591794,0.9473732911515593,1.0,-0.05066398570839683,-0.37082115507207336,0.927321320526576,
    0.3281762764214411,-0.00046664784121530634,0.9483073845226073,1.0,0.09338575233684604,-0.031050173821628228,0.9951457119267147,
    0.054924849755348726,0.09418469044097821,0.9769029260813866,1.0,0.09338575233684604,-0.031050173821628228,0.9951457119267147,
    -0.12536155236586477,-0.006215589707264213,0.9906885807683656,1.0,0.09338575233684604,-0.031050173821628228,0.9951457119267147,
    0.1781047237524549,0.16935248424166138,0.6754013570278761,1.0,-0.025475500242458548,0.6135369181886832,-0.7892549961241485,
    -0.014260279414368915,0.0956269114613495,0.6242990311274053,1.0,-0.025475500242458548,0.6135369181886832,-0.7892549961241485,
    -0.15133987757075107,0.16843434464296259,0.6853214126746341,1.0,-0.025475500242458548,0.6135369181886832,-0.7892549961241485,
    0.1781047237524549,0.16935248424166138,0.6754013570278761,1.0,-0.13111192383910478,0.77264459439669,-0.6211521505853322,
    0.27283583089639474,0.09682823051924738,0.5651934953279378,1.0,-0.13111192383910478,0.77264459439669,-0.6211521505853322,
    -0.014260279414368915,0.0956269114613495,0.6242990311274053,1.0,-0.13111192383910478,0.77264459439669,-0.6211521505853322,
    0.27283583089639474,0.09682823051924738,0.5651934953279378,1.0,-0.20134122309416677,0.07819684743118825,-0.9763948816614968,
    0.07530659162012143,-0.0039182464889735424,0.5978572488357736,1.0,-0.20134122309416677,0.07819684743118825,-0.9763948816614968,
    -0.014260279414368915,0.0956269114613495,0.6242990311274053,1.0,-0.20134122309416677,0.07819684743118825,-0.9763948816614968,
    0.20601345541159932,-0.20383975392901532,0.779556357498512,1.0,0.06912019570084295,-0.9175611301923747,0.3915405099173889,
    0.39578357750581916,-0.17800581036388963,0.8065964062532405,1.0,0.06912019570084295,-0.9175611301923747,0.3915405099173889,
    -0.1233856776604112,-0.1757523400195593,0.9035283362927582,1.0,0.06912019570084295,-0.9175611301923747,0.3915405099173889,
    0.4773073542104398,0.09773839323177169,0.8428242325038966,1.0,0.25973015933439114,0.4915012424828096,0.8312441115400373,
    0.24542166618007655,0.16953914337814746,0.8728245037180267,1.0,0.25973015933439114,0.4915012424828096,0.8312441115400373,
    0.054924849755348726,0.09418469044097821,0.9769029260813866,1.0,0.25973015933439114,0.4915012424828096,0.8312441115400373,
    0.38836028723171734,-0.10056619938067457,0.4946148041435139,1.0,-0.23851354236708153,-0.7154009155359574,-0.6567441055371722,
    0.05411120736553765,-0.17683320809622038,0.699084732080324,1.0,-0.23851354236708153,-0.7154009155359574,-0.6567441055371722,
    0.033979939726648034,-0.10466472349719458,0.6277817396312446,1.0,-0.23851354236708153,-0.7154009155359574,-0.6567441055371722,
    0.4250037092520711,-0.17566698733749098,0.558157084033305,1.0,-0.07085675690634782,-0.9783247811621364,-0.19457631552882487,
    0.20601345541159932,-0.20383975392901532,0.779556357498512,1.0,-0.07085675690634782,-0.9783247811621364,-0.19457631552882487,
    0.05411120736553765,-0.17683320809622038,0.699084732080324,1.0,-0.07085675690634782,-0.9783247811621364,-0.19457631552882487,
    0.39578357750581916,-0.17800581036388963,0.8065964062532405,1.0,0.2452204622472104,-0.6375739255306961,0.7303193920324469,
    0.4828002380302834,-0.10730267975514152,0.839103015103436,1.0,0.2452204622472104,-0.6375739255306961,0.7303193920324469,
    0.11907018223994137,-0.10225809693831156,0.9656371697369701,1.0,0.2452204622472104,-0.6375739255306961,0.7303193920324469,
    0.38011218692715976,0.19550390787653682,0.7351514252302529,1.0,-0.08039047466727618,0.9840171838442097,-0.1588947874603854,
    0.4584300530782006,0.1681439859862064,0.5260907992999484,1.0,-0.08039047466727618,0.9840171838442097,-0.1588947874603854,
    0.1781047237524549,0.16935248424166138,0.6754013570278761,1.0,-0.08039047466727618,0.9840171838442097,-0.1588947874603854,
    0.27283583089639474,0.09682823051924738,0.5651934953279378,1.0,-0.35417907276448246,0.4242118639018293,-0.8334275487051213,
    0.3543635960441025,-0.0039182464889735424,0.47926727514354406,1.0,-0.35417907276448246,0.4242118639018293,-0.8334275487051213,
    0.07530659162012143,-0.0039182464889735424,0.5978572488357736,1.0,-0.35417907276448246,0.4242118639018293,-0.8334275487051213,
    0.3543635960441025,-0.0039182464889735424,0.47926727514354406,1.0,-0.3762631719192405,-0.2729526603541778,-0.8853941894223436,
    0.38836028723171734,-0.10056619938067457,0.4946148041435139,1.0,-0.3762631719192405,-0.2729526603541778,-0.8853941894223436,
    0.07530659162012143,-0.0039182464889735424,0.5978572488357736,1.0,-0.3762631719192405,-0.2729526603541778,-0.8853941894223436,
    0.7559583351281327,0.1714767290299628,0.503815344657321,1.0,0.35735797597094515,0.7897654509795483,0.4985637466252637,
    0.38011218692715976,0.19550390787653682,0.7351514252302529,1.0,0.35735797597094515,0.7897654509795483,0.4985637466252637,
    0.24542166618007655,0.16953914337814746,0.8728245037180267,1.0,0.35735797597094515,0.7897654509795483,0.4985637466252637,
    0.4250037092520711,-0.17566698733749098,0.558157084033305,1.0,-0.2951763228338711,-0.8666434540124105,-0.4022437843593278,
    0.7102898640898134,-0.20334040085448402,0.4084301328470623,1.0,-0.2951763228338711,-0.8666434540124105,-0.4022437843593278,
    0.20601345541159932,-0.20383975392901532,0.779556357498512,1.0,-0.2951763228338711,-0.8666434540124105,-0.4022437843593278,
    0.6938710392765921,0.05014908800260365,0.7105666620400726,1.0,0.4839219703567415,0.6835366205972376,0.5464404953044356,
    0.7559583351281327,0.1714767290299628,0.503815344657321,1.0,0.4839219703567415,0.6835366205972376,0.5464404953044356,
    0.4773073542104398,0.09773839323177169,0.8428242325038966,1.0,0.4839219703567415,0.6835366205972376,0.5464404953044356,
    0.4584300530782006,0.1681439859862064,0.5260907992999484,1.0,-0.4003468235180095,0.7666152116535492,-0.5020194599419666,
    0.46949080344792926,0.09509644853073729,0.40572197999077875,1.0,-0.4003468235180095,0.7666152116535492,-0.5020194599419666,
    0.27283583089639474,0.09682823051924738,0.5651934953279378,1.0,-0.4003468235180095,0.7666152116535492,-0.5020194599419666,
    0.6941558141130262,-0.14951875445708518,0.6325295822823784,1.0,0.39209872392530276,-0.7361849848861027,0.5516251070468041,
    0.4828002380302834,-0.10730267975514152,0.839103015103436,1.0,0.39209872392530276,-0.7361849848861027,0.5516251070468041,
    0.39578357750581916,-0.17800581036388963,0.8065964062532405,1.0,0.39209872392530276,-0.7361849848861027,0.5516251070468041,
    0.6941558141130262,-0.14951875445708518,0.6325295822823784,1.0,0.6423879283528798,-0.27818240135073447,0.7141094461532029,
    0.6938710392765921,0.05014908800260365,0.7105666620400726,1.0,0.6423879283528798,-0.27818240135073447,0.7141094461532029,
    0.4828002380302834,-0.10730267975514152,0.839103015103436,1.0,0.6423879283528798,-0.27818240135073447,0.7141094461532029,
    0.46949080344792926,0.09509644853073729,0.40572197999077875,1.0,-0.6981463360810688,0.34631702604826126,-0.6266228617642892,
    0.5177294272117112,-0.0039182464889735424,0.2972546748541425,1.0,-0.6981463360810688,0.34631702604826126,-0.6266228617642892,
    0.3543635960441025,-0.0039182464889735424,0.47926727514354406,1.0,-0.6981463360810688,0.34631702604826126,-0.6266228617642892,
    0.5177294272117112,-0.0039182464889735424,0.2972546748541425,1.0,-0.6984438278418048,-0.34523224427666627,-0.6268898761835155,
    0.38836028723171734,-0.10056619938067457,0.4946148041435139,1.0,-0.6984438278418048,-0.34523224427666627,-0.6268898761835155,
    0.3543635960441025,-0.0039182464889735424,0.47926727514354406,1.0,-0.6984438278418048,-0.34523224427666627,-0.6268898761835155,
    0.8632665987035963,-0.0039182464889735424,0.49675101426107715,1.0,0.7694506308465401,0.3797115998913105,0.5135804003248592,
    0.8985778807327887,0.09608957085947756,0.3699073564439679,1.0,0.7694506308465401,0.3797115998913105,0.5135804003248592,
    0.6938710392765921,0.05014908800260365,0.7105666620400726,1.0,0.7694506308465401,0.3797115998913105,0.5135804003248592,
    0.8985778807327887,0.09608957085947756,0.3699073564439679,1.0,0.7218148945286025,0.48009215259665994,0.49849251052725746,
    0.7559583351281327,0.1714767290299628,0.503815344657321,1.0,0.7218148945286025,0.48009215259665994,0.49849251052725746,
    0.6938710392765921,0.05014908800260365,0.7105666620400726,1.0,0.7218148945286025,0.48009215259665994,0.49849251052725746,
    0.38011218692715976,0.19550390787653682,0.7351514252302529,1.0,-0.35249217234664343,0.901784724925251,-0.25006714763405796,
    0.6451003572049627,0.16899910818412556,0.26604590538455763,1.0,-0.35249217234664343,0.901784724925251,-0.25006714763405796,
    0.4584300530782006,0.1681439859862064,0.5260907992999484,1.0,-0.35249217234664343,0.901784724925251,-0.25006714763405796,
    0.6451003572049627,0.16899910818412556,0.26604590538455763,1.0,-0.6246454735043347,0.6408162796503893,-0.44628749496885917,
    0.46949080344792926,0.09509644853073729,0.40572197999077875,1.0,-0.6246454735043347,0.6408162796503893,-0.44628749496885917,
    0.4584300530782006,0.1681439859862064,0.5260907992999484,1.0,-0.6246454735043347,0.6408162796503893,-0.44628749496885917,
    0.38836028723171734,-0.10056619938067457,0.4946148041435139,1.0,-0.6174408787655065,-0.6614611060323483,-0.42571817724375083,
    0.6772831044764691,-0.17621499941768726,0.1931148304672381,1.0,-0.6174408787655065,-0.6614611060323483,-0.42571817724375083,
    0.4250037092520711,-0.17566698733749098,0.558157084033305,1.0,-0.6174408787655065,-0.6614611060323483,-0.42571817724375083,
    0.6772831044764691,-0.17621499941768726,0.1931148304672381,1.0,-0.14851643172152992,-0.9837220348821902,-0.10116238231648705,
    0.7102898640898134,-0.20334040085448402,0.4084301328470623,1.0,-0.14851643172152992,-0.9837220348821902,-0.10116238231648705,
    0.4250037092520711,-0.17566698733749098,0.558157084033305,1.0,-0.14851643172152992,-0.9837220348821902,-0.10116238231648705,
    0.9247604142237453,-0.1020211834189253,0.31706128322572513,1.0,0.7602658510756364,-0.4243498046822709,0.49185676670587414,
    0.8632665987035963,-0.0039182464889735424,0.49675101426107715,1.0,0.7602658510756364,-0.4243498046822709,0.49185676670587414,
    0.6941558141130262,-0.14951875445708518,0.6325295822823784,1.0,0.7602658510756364,-0.4243498046822709,0.49185676670587414,
    1.0,-0.0039182464889735424,0.08069976436278248,1.0,0.9482734584198954,0.060450784831480316,0.31164587382095876,
    0.8985778807327887,0.09608957085947756,0.3699073564439679,1.0,0.9482734584198954,0.060450784831480316,0.31164587382095876,
    0.8632665987035963,-0.0039182464889735424,0.49675101426107715,1.0,0.9482734584198954,0.060450784831480316,0.31164587382095876,
    0.9247604142237453,-0.1020211834189253,0.31706128322572513,1.0,0.9497458615433149,0.023617864955808414,0.31212977258870384,
    1.0,-0.0039182464889735424,0.08069976436278248,1.0,0.9497458615433149,0.023617864955808414,0.31212977258870384,
    0.8632665987035963,-0.0039182464889735424,0.49675101426107715,1.0,0.9497458615433149,0.023617864955808414,0.31212977258870384,
    0.8985778807327887,0.09608957085947756,0.3699073564439679,1.0,0.5629979800564082,0.8143092327248929,0.14118692556820023,
    0.9033680008806482,0.167903084023733,-0.06338513523215128,1.0,0.5629979800564082,0.8143092327248929,0.14118692556820023,
    0.7559583351281327,0.1714767290299628,0.503815344657321,1.0,0.5629979800564082,0.8143092327248929,0.14118692556820023,
    0.8156158714508839,0.19550390787653682,0.08667684517342544,1.0,-0.18525570656501705,0.9822020622216352,-0.030974701817180133,
    0.6964954348280423,0.16727131463870282,-0.09612945529035077,1.0,-0.18525570656501705,0.9822020622216352,-0.030974701817180133,
    0.6451003572049627,0.16899910818412556,0.26604590538455763,1.0,-0.18525570656501705,0.9822020622216352,-0.030974701817180133,
    0.6964954348280423,0.16727131463870282,-0.09612945529035077,1.0,-0.7165146653126423,0.6926020703181119,-0.0831210357429289,
    0.6214129937094277,0.09574417168811644,-0.04490508303140828,1.0,-0.7165146653126423,0.6926020703181119,-0.0831210357429289,
    0.5928517527611992,0.09542748930698397,0.19865796866998187,1.0,-0.7165146653126423,0.6926020703181119,-0.0831210357429289,
    0.6214129937094277,0.09574417168811644,-0.04490508303140828,1.0,-0.984027547767985,0.13570309698851252,-0.11521481979959257,
    0.5982489139469473,-0.0039182464889735424,0.03554979092581334,1.0,-0.984027547767985,0.13570309698851252,-0.11521481979959257,
    0.5928517527611992,0.09542748930698397,0.19865796866998187,1.0,-0.984027547767985,0.13570309698851252,-0.11521481979959257,
    0.5982489139469473,-0.0039182464889735424,0.03554979092581334,1.0,-0.984027422525935,-0.13570369792131648,-0.11521518167084191,
    0.6214129937094277,-0.10358066466606353,-0.04490428534279067,1.0,-0.984027422525935,-0.13570369792131648,-0.11521518167084191,
    0.5928517527611992,-0.10326398228493117,0.19865796866998187,1.0,-0.984027422525935,-0.13570369792131648,-0.11521518167084191,
    0.6214129937094277,-0.10358066466606353,-0.04490428534279067,1.0,-0.6547531444361093,-0.752032205609636,-0.07580159349864263,
    0.6772831044764691,-0.17621499941768726,0.1931148304672381,1.0,-0.6547531444361093,-0.752032205609636,-0.07580159349864263,
    0.5928517527611992,-0.10326398228493117,0.19865796866998187,1.0,-0.6547531444361093,-0.752032205609636,-0.07580159349864263,
    0.6772831044764691,-0.17621499941768726,0.1931148304672381,1.0,-0.42331039713420915,-0.9046544995568193,-0.04907692033613309,
    0.7809108327709628,-0.2030994988920105,-0.20514796326165308,1.0,-0.42331039713420915,-0.9046544995568193,-0.04907692033613309,
    0.7102898640898134,-0.20334040085448402,0.4084301328470623,1.0,-0.42331039713420915,-0.9046544995568193,-0.04907692033613309,
    0.8747788408308088,-0.17785185646071933,0.229021188205057,1.0,0.8025607878436405,-0.5939410440139045,0.05594835164210076,
    0.9565403287434329,-0.10661427447827176,-0.18757089457587706,1.0,0.8025607878436405,-0.5939410440139045,0.05594835164210076,
    0.9247604142237453,-0.1020211834189253,0.31706128322572513,1.0,0.8025607878436405,-0.5939410440139045,0.05594835164210076,
    0.7809108327709628,-0.2030994988920105,-0.20514796326165308,1.0,0.2890544279914068,-0.9572883273955389,-0.006826118282904763,
    0.8687004535657479,-0.1763490111054209,-0.2391279029883011,1.0,0.2890544279914068,-0.9572883273955389,-0.006826118282904763,
    0.8747788408308088,-0.17785185646071933,0.229021188205057,1.0,0.2890544279914068,-0.9572883273955389,-0.006826118282904763,
    0.9078087334140592,-0.0039182464889735424,-0.4325961095130749,1.0,0.9527768257583402,0.22810030396216774,-0.20046588645010963,
    0.893282026001458,0.09787080954227023,-0.3858180536078659,1.0,0.9527768257583402,0.22810030396216774,-0.20046588645010963,
    0.9720226671197536,0.09448621673837887,-0.015429690927568407,1.0,0.9527768257583402,0.22810030396216774,-0.20046588645010963,
    0.6964954348280423,0.16727131463870282,-0.09612945529035077,1.0,-0.623178519463927,0.7662547265742066,0.15653187177516306,
    0.5613047633178101,0.09542748930698397,-0.2826553777773524,1.0,-0.623178519463927,0.7662547265742066,0.15653187177516306,
    0.6214129937094277,0.09574417168811644,-0.04490508303140828,1.0,-0.623178519463927,0.7662547265742066,0.15653187177516306,
    0.6214129937094277,0.09574417168811644,-0.04490508303140828,1.0,-0.9444568069384216,0.22611938324051079,0.23847717784016997,
    0.5613047633178101,0.09542748930698397,-0.2826553777773524,1.0,-0.9444568069384216,0.22611938324051079,0.23847717784016997,
    0.5409724781473202,-0.00598904613990503,-0.2670174901206265,1.0,-0.9444568069384216,0.22611938324051079,0.23847717784016997,
    0.5409724781473202,-0.00598904613990503,-0.2670174901206265,1.0,-0.9431093026694076,-0.2292120470899446,0.24084576119845016,
    0.5588925529386051,-0.10464478128175803,-0.29073596347224284,1.0,-0.9431093026694076,-0.2292120470899446,0.24084576119845016,
    0.6214129937094277,-0.10358066466606353,-0.04490428534279067,1.0,-0.9431093026694076,-0.2292120470899446,0.24084576119845016,
    0.6214129937094277,-0.10358066466606353,-0.04490428534279067,1.0,-0.6136549011921559,-0.7733143086326352,0.15941343201523073,
    0.5588925529386051,-0.10464478128175803,-0.29073596347224284,1.0,-0.6136549011921559,-0.7733143086326352,0.15941343201523073,
    0.6648519250619407,-0.17640006317693846,-0.23093484319834845,1.0,-0.6136549011921559,-0.7733143086326352,0.15941343201523073,
    0.893282026001458,0.09787080954227023,-0.3858180536078659,1.0,0.5300455327139694,0.8250581458176577,-0.19578250501485905,
    0.7166865291132416,0.170734878615723,-0.5568576492754596,1.0,0.5300455327139694,0.8250581458176577,-0.19578250501485905,
    0.9033680008806482,0.167903084023733,-0.06338513523215128,1.0,0.5300455327139694,0.8250581458176577,-0.19578250501485905,
    0.7166865291132416,0.170734878615723,-0.5568576492754596,1.0,0.2385848366173153,0.9683022417155236,-0.07394622657702464,
    0.6335011670184474,0.19526300591406343,-0.5040642235059691,1.0,0.2385848366173153,0.9683022417155236,-0.07394622657702464,
    0.8156158714508839,0.19550390787653682,0.08667684517342544,1.0,0.2385848366173153,0.9683022417155236,-0.07394622657702464,
    0.8156158714508839,0.19550390787653682,0.08667684517342544,1.0,-0.40612282629079266,0.9052521442848714,0.12483110683327742,
    0.6335011670184474,0.19526300591406343,-0.5040642235059691,1.0,-0.40612282629079266,0.9052521442848714,0.12483110683327742,
    0.6964954348280423,0.16727131463870282,-0.09612945529035077,1.0,-0.40612282629079266,0.9052521442848714,0.12483110683327742,
    0.6335011670184474,0.19526300591406343,-0.5040642235059691,1.0,-0.20028736252456034,0.9748415790844583,0.09782059139606082,
    0.5049863515477553,0.1682006218780463,-0.4975048300045787,1.0,-0.20028736252456034,0.9748415790844583,0.09782059139606082,
    0.6964954348280423,0.16727131463870282,-0.09612945529035077,1.0,-0.20028736252456034,0.9748415790844583,0.09782059139606082,
    0.7809108327709628,-0.2030994988920105,-0.20514796326165308,1.0,0.24023348230532077,-0.9611420080807489,-0.13599233170280048,
    0.6296275910920519,-0.17647983203868467,-0.6605308458211486,1.0,0.24023348230532077,-0.9611420080807489,-0.13599233170280048,
    0.8687004535657479,-0.1763490111054209,-0.2391279029883011,1.0,0.24023348230532077,-0.9611420080807489,-0.13599233170280048,
    0.8687004535657479,-0.1763490111054209,-0.2391279029883011,1.0,0.5303194573266959,-0.792710617505297,-0.300617947027601,
    0.6296275910920519,-0.17647983203868467,-0.6605308458211486,1.0,0.5303194573266959,-0.792710617505297,-0.300617947027601,
    0.7754171512625019,-0.10570730252021743,-0.589966513031839,1.0,0.5303194573266959,-0.792710617505297,-0.300617947027601,
    0.9078087334140592,-0.0039182464889735424,-0.4325961095130749,1.0,0.7575431398168954,0.35874293207349167,-0.5453731749945848,
    0.6329994208780636,0.09421580029705923,-0.74976428301354,1.0,0.7575431398168954,0.35874293207349167,-0.5453731749945848,
    0.893282026001458,0.09787080954227023,-0.3858180536078659,1.0,0.7575431398168954,0.35874293207349167,-0.5453731749945848,
    0.893282026001458,0.09787080954227023,-0.3858180536078659,1.0,0.6981706059950903,0.5080619273728781,-0.5044114222324914,
    0.6329994208780636,0.09421580029705923,-0.74976428301354,1.0,0.6981706059950903,0.5080619273728781,-0.5044114222324914,
    0.7166865291132416,0.170734878615723,-0.5568576492754596,1.0,0.6981706059950903,0.5080619273728781,-0.5044114222324914,
    0.5588925529386051,-0.10464478128175803,-0.29073596347224284,1.0,-0.6607567226924251,-0.6012543268050448,0.4493259261549214,
    0.4584300530782006,-0.17598047896415348,-0.5339272922778956,1.0,-0.6607567226924251,-0.6012543268050448,0.4493259261549214,
    0.6648519250619407,-0.17640006317693846,-0.23093484319834845,1.0,-0.6607567226924251,-0.6012543268050448,0.4493259261549214,
    0.6648519250619407,-0.17640006317693846,-0.23093484319834845,1.0,-0.2593490669082473,-0.9497274433732494,0.17537344382070116,
    0.4584300530782006,-0.17598047896415348,-0.5339272922778956,1.0,-0.2593490669082473,-0.9497274433732494,0.17537344382070116,
    0.46388544553302347,-0.20334040085448402,-0.6740261418513714,1.0,-0.2593490669082473,-0.9497274433732494,0.17537344382070116,
    0.41087504845958356,0.0963272820674812,-0.4738836746642927,1.0,-0.7246574658087044,0.31635260739174736,0.6122030586693842,
    0.359125797090351,-0.0024552855645483262,-0.48409329127918943,1.0,-0.7246574658087044,0.31635260739174736,0.6122030586693842,
    0.5409724781473202,-0.00598904613990503,-0.2670174901206265,1.0,-0.7246574658087044,0.31635260739174736,0.6122030586693842,
    0.359125797090351,-0.0024552855645483262,-0.48409329127918943,1.0,-0.7322989040730842,-0.19964440433772423,0.6510610009131209,
    0.349849476157885,-0.1017068941036453,-0.5249620699062396,1.0,-0.7322989040730842,-0.19964440433772423,0.6510610009131209,
    0.5588925529386051,-0.10464478128175803,-0.29073596347224284,1.0,-0.7322989040730842,-0.19964440433772423,0.6510610009131209,
    0.6296275910920519,-0.17647983203868467,-0.6605308458211486,1.0,0.5634674847218151,-0.5235314932983282,-0.6390768100831806,
    0.48074140370861396,-0.10225809693831156,-0.8526046926425989,1.0,0.5634674847218151,-0.5235314932983282,-0.6390768100831806,
    0.7754171512625019,-0.10570730252021743,-0.589966513031839,1.0,0.5634674847218151,-0.5235314932983282,-0.6390768100831806,
    0.655325927592209,-0.0039182464889735424,-0.7556424504356178,1.0,0.5242245511886436,0.16925789732398852,-0.8345899496905814,
    0.3792778046332945,-0.0039182464889735424,-0.9290344298361068,1.0,0.5242245511886436,0.16925789732398852,-0.8345899496905814,
    0.6329994208780636,0.09421580029705923,-0.74976428301354,1.0,0.5242245511886436,0.16925789732398852,-0.8345899496905814,
    0.7166865291132416,0.170734878615723,-0.5568576492754596,1.0,0.11254211630623226,0.9797672536823588,-0.16550045519285728,
    0.2883452906857089,0.167903084023733,-0.8648986696149239,1.0,0.11254211630623226,0.9797672536823588,-0.16550045519285728,
    0.11259773679785456,0.19585489086822028,-0.8189334584109087,1.0,0.11254211630623226,0.9797672536823588,-0.16550045519285728,
    0.6335011670184474,0.19526300591406343,-0.5040642235059691,1.0,-0.1816267181599048,0.9357708029323771,0.30223292280914205,
    0.11259773679785456,0.19585489086822028,-0.8189334584109087,1.0,-0.1816267181599048,0.9357708029323771,0.30223292280914205,
    0.5049863515477553,0.1682006218780463,-0.4975048300045787,1.0,-0.1816267181599048,0.9357708029323771,0.30223292280914205,
    0.41087504845958356,0.0963272820674812,-0.4738836746642927,1.0,-0.4896298358418403,0.16807474993197835,0.8555778762268198,
    0.16459985545882239,0.09299214595787242,-0.6141667903084023,1.0,-0.4896298358418403,0.16807474993197835,0.8555778762268198,
    0.359125797090351,-0.0024552855645483262,-0.48409329127918943,1.0,-0.4896298358418403,0.16807474993197835,0.8555778762268198,
    0.48074140370861396,-0.10225809693831156,-0.8526046926425989,1.0,0.5287473767815699,-0.10869667504784597,-0.8417904991030436,
    0.3792778046332945,-0.0039182464889735424,-0.9290344298361068,1.0,0.5287473767815699,-0.10869667504784597,-0.8417904991030436,
    0.655325927592209,-0.0039182464889735424,-0.7556424504356178,1.0,0.5287473767815699,-0.10869667504784597,-0.8417904991030436,
    0.3792778046332945,-0.0039182464889735424,-0.9290344298361068,1.0,0.4421818024811423,0.35859785762776974,-0.8221209339624567,
    0.3024101363887999,0.09687369877044283,-0.9264140227277441,1.0,0.4421818024811423,0.35859785762776974,-0.8221209339624567,
    0.6329994208780636,0.09421580029705923,-0.74976428301354,1.0,0.4421818024811423,0.35859785762776974,-0.8221209339624567,
    0.11259773679785456,0.19585489086822028,-0.8189334584109087,1.0,-0.14161707580655108,0.956468608847669,0.2551713230929494,
    0.1781047237524549,0.16935248424166138,-0.6832378500058232,1.0,-0.14161707580655108,0.956468608847669,0.2551713230929494,
    0.5049863515477553,0.1682006218780463,-0.4975048300045787,1.0,-0.14161707580655108,0.956468608847669,0.2551713230929494,
    0.16459985545882239,0.09299214595787242,-0.6141667903084023,1.0,-0.38698017846169636,0.3651747970646847,0.8466957594475834,
    0.10775895764432986,-0.005864606715580978,-0.59750945659856,1.0,-0.38698017846169636,0.3651747970646847,0.8466957594475834,
    0.359125797090351,-0.0024552855645483262,-0.48409329127918943,1.0,-0.38698017846169636,0.3651747970646847,0.8466957594475834,
    0.359125797090351,-0.0024552855645483262,-0.48409329127918943,1.0,-0.38601236639397585,-0.3201655213289868,0.8651522940748992,
    0.10775895764432986,-0.005864606715580978,-0.59750945659856,1.0,-0.38601236639397585,-0.3201655213289868,0.8651522940748992,
    0.349849476157885,-0.1017068941036453,-0.5249620699062396,1.0,-0.38601236639397585,-0.3201655213289868,0.8651522940748992,
    0.4584300530782006,-0.17598047896415348,-0.5339272922778956,1.0,-0.09146195250798768,-0.9780097882368309,0.1874341627248772,
    0.13273618363430129,-0.17682602889866328,-0.6972675974097455,1.0,-0.09146195250798768,-0.9780097882368309,0.1874341627248772,
    0.46388544553302347,-0.20334040085448402,-0.6740261418513714,1.0,-0.09146195250798768,-0.9780097882368309,0.1874341627248772,
    0.6296275910920519,-0.17647983203868467,-0.6605308458211486,1.0,0.25899417007824327,-0.8163578126496616,-0.5162188892236915,
    0.16008812863845723,-0.17707570543592888,-0.8951629757614337,1.0,0.25899417007824327,-0.8163578126496616,-0.5162188892236915,
    0.48074140370861396,-0.10225809693831156,-0.8526046926425989,1.0,0.25899417007824327,-0.8163578126496616,-0.5162188892236915,
    0.16008812863845723,-0.17707570543592888,-0.8951629757614337,1.0,0.2436592290316429,-0.6200732139394602,-0.7457475373492652,
    0.11205451084936291,-0.10232270971632595,-0.9730125986940241,1.0,0.2436592290316429,-0.6200732139394602,-0.7457475373492652,
    0.48074140370861396,-0.10225809693831156,-0.8526046926425989,1.0,0.2436592290316429,-0.6200732139394602,-0.7457475373492652,
    0.48074140370861396,-0.10225809693831156,-0.8526046926425989,1.0,0.2864527660368003,-0.385979668525655,-0.8769062140928707,
    0.11205451084936291,-0.10232270971632595,-0.9730125986940241,1.0,0.2864527660368003,-0.385979668525655,-0.8769062140928707,
    0.3792778046332945,-0.0039182464889735424,-0.9290344298361068,1.0,0.2864527660368003,-0.385979668525655,-0.8769062140928707,
    0.07299409231809917,-0.0039182464889735424,-1.0,1.0,0.12973840069686085,0.37487481842431547,-0.9179525139657047,
    -0.08094146401387337,0.09421580029705923,-0.9816802832113667,1.0,0.12973840069686085,0.37487481842431547,-0.9179525139657047,
    0.3024101363887999,0.09687369877044283,-0.9264140227277441,1.0,0.12973840069686085,0.37487481842431547,-0.9179525139657047,
    0.3024101363887999,0.09687369877044283,-0.9264140227277441,1.0,0.10235160055913119,0.6627319468369133,-0.7418291693541975,
    -0.08094146401387337,0.09421580029705923,-0.9816802832113667,1.0,0.10235160055913119,0.6627319468369133,-0.7418291693541975,
    0.2883452906857089,0.167903084023733,-0.8648986696149239,1.0,0.10235160055913119,0.6627319468369133,-0.7418291693541975,
    -0.08094146401387337,0.09421580029705923,-0.9816802832113667,1.0,0.05009443736713499,0.7655308797291782,-0.6414460378909053,
    -0.13415527168476626,0.16935487730751375,-0.8961616819104962,1.0,0.05009443736713499,0.7655308797291782,-0.6414460378909053,
    0.2883452906857089,0.167903084023733,-0.8648986696149239,1.0,0.05009443736713499,0.7655308797291782,-0.6414460378909053,
    0.1781047237524549,0.16935248424166138,-0.6832378500058232,1.0,0.006930987419538853,0.6701326781590728,0.7422089699516833,
    -0.23240019718862626,0.1666937880796604,-0.6770039134603573,1.0,0.006930987419538853,0.6701326781590728,0.7422089699516833,
    0.16459985545882239,0.09299214595787242,-0.6141667903084023,1.0,0.006930987419538853,0.6701326781590728,0.7422089699516833,
    -0.24744141375949047,0.09469600884477147,-0.5918354974625525,1.0,0.04473206185222877,0.10193003986287837,0.9937853438323592,
    -0.15405361424735686,-0.0025398405579991623,-0.5860658156924496,1.0,0.04473206185222877,0.10193003986287837,0.9937853438323592,
    0.10775895764432986,-0.005864606715580978,-0.59750945659856,1.0,0.04473206185222877,0.10193003986287837,0.9937853438323592,
    0.04910092515925846,-0.10320335795000402,-0.6329443803634589,1.0,0.0427554656214855,-0.6293578089310798,0.7759386048502552,
    -0.1957487982820978,-0.17682762427589815,-0.6791688403681493,1.0,0.0427554656214855,-0.6293578089310798,0.7759386048502552,
    0.13273618363430129,-0.17682602889866328,-0.6972675974097455,1.0,0.0427554656214855,-0.6293578089310798,0.7759386048502552,
    0.13273618363430129,-0.17682602889866328,-0.6972675974097455,1.0,0.008969436395942897,-0.9866340562851161,0.16270460408088486,
    -0.1957487982820978,-0.17682762427589815,-0.6791688403681493,1.0,0.008969436395942897,-0.9866340562851161,0.16270460408088486,
    -0.23468637276627247,-0.2020696828868671,-0.8300891337261153,1.0,0.008969436395942897,-0.9866340562851161,0.16270460408088486,
    0.16008812863845723,-0.17707570543592888,-0.8951629757614337,1.0,-0.06284245019507047,-0.7428137238625592,-0.6665422702986793,
    -0.23468637276627247,-0.2020696828868671,-0.8300891337261153,1.0,-0.06284245019507047,-0.7428137238625592,-0.6665422702986793,
    -0.32437289709338224,-0.10466073505410722,-0.9301886852655744,1.0,-0.06284245019507047,-0.7428137238625592,-0.6665422702986793,
    0.11205451084936291,-0.10232270971632595,-0.9730125986940241,1.0,-0.0914442800778051,-0.3033281535131949,-0.9484882576644413,
    -0.32437289709338224,-0.10466073505410722,-0.9301886852655744,1.0,-0.0914442800778051,-0.3033281535131949,-0.9484882576644413,
    -0.30992436316529226,-0.0039182464889735424,-0.9637992951623375,1.0,-0.0914442800778051,-0.3033281535131949,-0.9484882576644413,
    -0.1957487982820978,-0.17682762427589815,-0.6791688403681493,1.0,0.10436277134796638,-0.9849450077478722,0.13781053540682725,
    -0.4162578512502174,-0.20359486352345446,-0.7034871755600971,1.0,0.10436277134796638,-0.9849450077478722,0.13781053540682725,
    -0.23468637276627247,-0.2020696828868671,-0.8300891337261153,1.0,0.10436277134796638,-0.9849450077478722,0.13781053540682725,
    -0.30992436316529226,-0.0039182464889735424,-0.9637992951623375,1.0,-0.2801087748474686,0.5048200548753689,-0.816514412885088,
    -0.5411431835114573,0.09877857918894217,-0.8209851135350208,1.0,-0.2801087748474686,0.5048200548753689,-0.816514412885088,
    -0.08094146401387337,0.09421580029705923,-0.9816802832113667,1.0,-0.2801087748474686,0.5048200548753689,-0.816514412885088,
    -0.5411431835114573,0.09877857918894217,-0.8209851135350208,1.0,-0.24551595000732906,0.6822458160171152,-0.6886672380904578,
    -0.46779890589029227,0.16888025258012385,-0.7776849800019463,1.0,-0.24551595000732906,0.6822458160171152,-0.6886672380904578,
    -0.13415527168476626,0.16935487730751375,-0.8961616819104962,1.0,-0.24551595000732906,0.6822458160171152,-0.6886672380904578,
    -0.13415527168476626,0.16935487730751375,-0.8961616819104962,1.0,-0.07266569135817023,0.9769497334320065,-0.20072098955159265,
    -0.46779890589029227,0.16888025258012385,-0.7776849800019463,1.0,-0.07266569135817023,0.9769497334320065,-0.20072098955159265,
    -0.5377099317019006,0.1951928093157269,-0.6243070080135799,1.0,-0.07266569135817023,0.9769497334320065,-0.20072098955159265,
    -0.4162578512502174,-0.20359486352345446,-0.7034871755600971,1.0,-0.15098774330872033,-0.9618513951581992,-0.22813284507664836,
    -0.5204623084151363,-0.17635220185989076,-0.7493805947885408,1.0,-0.15098774330872033,-0.9618513951581992,-0.22813284507664836,
    -0.23468637276627247,-0.2020696828868671,-0.8300891337261153,1.0,-0.15098774330872033,-0.9618513951581992,-0.22813284507664836,
    -0.23468637276627247,-0.2020696828868671,-0.8300891337261153,1.0,-0.23074404318647235,-0.7925329672611849,-0.5644897539709122,
    -0.5204623084151363,-0.17635220185989076,-0.7493805947885408,1.0,-0.23074404318647235,-0.7925329672611849,-0.5644897539709122,
    -0.32437289709338224,-0.10466073505410722,-0.9301886852655744,1.0,-0.23074404318647235,-0.7925329672611849,-0.5644897539709122,
    -0.28361818793862903,-0.1031243867768753,-0.571093200342687,1.0,0.3803559700744537,-0.5903977768203508,0.7118706351257289,
    -0.4662665460561477,-0.17598047896415348,-0.5339272922778956,1.0,0.3803559700744537,-0.5903977768203508,0.7118706351257289,
    -0.1957487982820978,-0.17682762427589815,-0.6791688403681493,1.0,0.3803559700744537,-0.5903977768203508,0.7118706351257289,
    -0.32437289709338224,-0.10466073505410722,-0.9301886852655744,1.0,-0.5109302862091781,-0.39891972614919063,-0.7614547227007408,
    -0.7343098637388303,-0.10661427447827176,-0.6541006778757872,1.0,-0.5109302862091781,-0.39891972614919063,-0.7614547227007408,
    -0.663162420570156,-0.0039182464889735424,-0.7556416527470003,1.0,-0.5109302862091781,-0.39891972614919063,-0.7614547227007408,
    -0.5411431835114573,0.09877857918894217,-0.8209851135350208,1.0,-0.45665315197193956,0.7616964277393685,-0.4596590592636869,
    -0.802130945372688,0.16864333906073758,-0.4459318678198053,1.0,-0.45665315197193956,0.7616964277393685,-0.4596590592636869,
    -0.46779890589029227,0.16888025258012385,-0.7776849800019463,1.0,-0.45665315197193956,0.7616964277393685,-0.4596590592636869,
    -0.46779890589029227,0.16888025258012385,-0.7776849800019463,1.0,-0.28539626668675316,0.9144407538641358,-0.2869618069249889,
    -0.802130945372688,0.16864333906073758,-0.4459318678198053,1.0,-0.28539626668675316,0.9144407538641358,-0.2869618069249889,
    -0.5377099317019006,0.1951928093157269,-0.6243070080135799,1.0,-0.28539626668675316,0.9144407538641358,-0.2869618069249889,
    -0.5377099317019006,0.1951928093157269,-0.6243070080135799,1.0,0.11452179010700048,0.9847535827720103,0.130939454742937,
    -0.6390490913528959,0.16780975445548973,-0.32973495997996205,1.0,0.11452179010700048,0.9847535827720103,0.130939454742937,
    -0.23240019718862626,0.1666937880796604,-0.6770039134603573,1.0,0.11452179010700048,0.9847535827720103,0.130939454742937,
    -0.6390490913528959,0.16780975445548973,-0.32973495997996205,1.0,0.5157689641055028,0.6115063900970573,0.600035257744078,
    -0.5337151071056507,0.09680828830381083,-0.34791747432639186,1.0,0.5157689641055028,0.6115063900970573,0.600035257744078,
    -0.24744141375949047,0.09469600884477147,-0.5918354974625525,1.0,0.5157689641055028,0.6115063900970573,0.600035257744078,
    -0.24744141375949047,0.09469600884477147,-0.5918354974625525,1.0,0.6485465059267754,-0.0010952021033727704,0.7611742442979292,
    -0.5337151071056507,0.09680828830381083,-0.34791747432639186,1.0,0.6485465059267754,-0.0010952021033727704,0.7611742442979292,
    -0.4032268099953574,-0.0039182464889735424,-0.4592428977793944,1.0,0.6485465059267754,-0.0010952021033727704,0.7611742442979292,
    -0.4032268099953574,-0.0039182464889735424,-0.4592428977793944,1.0,0.6654520820480354,-0.0381687532001081,0.7454640653828218,
    -0.5337151071056507,-0.10464478128175803,-0.34791747432639186,1.0,0.6654520820480354,-0.0381687532001081,0.7454640653828218,
    -0.28361818793862903,-0.1031243867768753,-0.571093200342687,1.0,0.6654520820480354,-0.0381687532001081,0.7454640653828218,
    -0.28361818793862903,-0.1031243867768753,-0.571093200342687,1.0,0.4083188192933404,-0.7929797882116807,0.45217120352655205,
    -0.5337151071056507,-0.10464478128175803,-0.34791747432639186,1.0,0.4083188192933404,-0.7929797882116807,0.45217120352655205,
    -0.4662665460561477,-0.17598047896415348,-0.5339272922778956,1.0,0.4083188192933404,-0.7929797882116807,0.45217120352655205,
    -0.663162420570156,-0.0039182464889735424,-0.7556416527470003,1.0,-0.7732451341108633,0.1668227269402667,-0.6117696791686282,
    -0.9059612865760174,-0.0039182464889735424,-0.44875648321423844,1.0,-0.7732451341108633,0.1668227269402667,-0.6117696791686282,
    -0.8498989328521676,0.09608957085947756,-0.49234538002683426,1.0,-0.7732451341108633,0.1668227269402667,-0.6117696791686282,
    -0.4662665460561477,-0.17598047896415348,-0.5339272922778956,1.0,0.2552289562920886,-0.9395437674228114,0.22828860892957656,
    -0.7298659404509493,-0.2035270599909702,-0.3525911319361019,1.0,0.2552289562920886,-0.9395437674228114,0.22828860892957656,
    -0.4162578512502174,-0.20359486352345446,-0.7034871755600971,1.0,0.2552289562920886,-0.9395437674228114,0.22828860892957656,
    -0.4162578512502174,-0.20359486352345446,-0.7034871755600971,1.0,-0.17507736988973618,-0.9720714633795134,-0.15628494692613157,
    -0.7298659404509493,-0.2035270599909702,-0.3525911319361019,1.0,-0.17507736988973618,-0.9720714633795134,-0.15628494692613157,
    -0.7835527774719971,-0.17754713940884892,-0.45404037261630703,1.0,-0.17507736988973618,-0.9720714633795134,-0.15628494692613157,
    -0.5204623084151363,-0.17635220185989076,-0.7493805947885408,1.0,-0.4389706535600019,-0.8073595020613321,-0.3943036897422882,
    -0.7835527774719971,-0.17754713940884892,-0.45404037261630703,1.0,-0.4389706535600019,-0.8073595020613321,-0.3943036897422882,
    -0.7343098637388303,-0.10661427447827176,-0.6541006778757872,1.0,-0.4389706535600019,-0.8073595020613321,-0.3943036897422882,
    -0.7343098637388303,-0.10661427447827176,-0.6541006778757872,1.0,-0.7823110299941345,-0.06999862773121132,-0.6189423595661099,
    -0.9059612865760174,-0.0039182464889735424,-0.44875648321423844,1.0,-0.7823110299941345,-0.06999862773121132,-0.6189423595661099,
    -0.663162420570156,-0.0039182464889735424,-0.7556416527470003,1.0,-0.7823110299941345,-0.06999862773121132,-0.6189423595661099,
    -0.5337151071056507,0.09680828830381083,-0.34791747432639186,1.0,0.7546067856643005,0.4547355607889196,0.4730583143581552,
    -0.5925398565117715,-0.006432561011213922,-0.1548401352241744,1.0,0.7546067856643005,0.4547355607889196,0.4730583143581552,
    -0.4032268099953574,-0.0039182464889735424,-0.4592428977793944,1.0,0.7546067856643005,0.4547355607889196,0.4730583143581552,
    -0.4032268099953574,-0.0039182464889735424,-0.4592428977793944,1.0,0.7543897858110017,-0.4629814049728638,0.46534317413429865,
    -0.5925398565117715,-0.006432561011213922,-0.1548401352241744,1.0,0.7543897858110017,-0.4629814049728638,0.46534317413429865,
    -0.5337151071056507,-0.10464478128175803,-0.34791747432639186,1.0,0.7543897858110017,-0.4629814049728638,0.46534317413429865,
    -0.5377099317019006,0.1951928093157269,-0.6243070080135799,1.0,0.4959947431396102,0.8321600933182038,0.2479895035409977,
    -0.8177417116164203,0.19579905266499775,-0.06626000500948448,1.0,0.4959947431396102,0.8321600933182038,0.2479895035409977,
    -0.6390490913528959,0.16780975445548973,-0.32973495997996205,1.0,0.4959947431396102,0.8321600933182038,0.2479895035409977,
    -0.9059612865760174,-0.0039182464889735424,-0.44875648321423844,1.0,-0.8831215264365094,0.36851968693588166,-0.29032672953954725,
    -0.9730125986940241,0.09448621673837887,-0.11989100382731,1.0,-0.8831215264365094,0.36851968693588166,-0.29032672953954725,
    -0.8498989328521676,0.09608957085947756,-0.49234538002683426,1.0,-0.8831215264365094,0.36851968693588166,-0.29032672953954725,
    -0.8498989328521676,0.09608957085947756,-0.49234538002683426,1.0,-0.733379488619836,0.6361675020772622,-0.2396777732132968,
    -0.9730125986940241,0.09448621673837887,-0.11989100382731,1.0,-0.733379488619836,0.6361675020772622,-0.2396777732132968,
    -0.802130945372688,0.16864333906073758,-0.4459318678198053,1.0,-0.733379488619836,0.6361675020772622,-0.2396777732132968,
    -0.5337151071056507,0.09680828830381083,-0.34791747432639186,1.0,0.9582132399426555,-0.011430066479336793,0.28582641651687274,
    -0.6363967766998345,0.09095803998334406,-0.0039182464889735424,1.0,0.9582132399426555,-0.011430066479336793,0.28582641651687274,
    -0.5925398565117715,-0.006432561011213922,-0.1548401352241744,1.0,0.9582132399426555,-0.011430066479336793,0.28582641651687274,
    -0.5925398565117715,-0.006432561011213922,-0.1548401352241744,1.0,0.948466190994555,-0.047753807544450896,0.31325941072103136,
    -0.6320398014712569,-0.1017068941036453,-0.049768590532074275,1.0,0.948466190994555,-0.047753807544450896,0.31325941072103136,
    -0.5337151071056507,-0.10464478128175803,-0.34791747432639186,1.0,0.948466190994555,-0.047753807544450896,0.31325941072103136,
    -0.7298659404509493,-0.2035270599909702,-0.3525911319361019,1.0,-0.28649716652306834,-0.9535965462424275,-0.09259049934397655,
    -0.9072423744956615,-0.17707570543592888,-0.07617048839283291,1.0,-0.28649716652306834,-0.9535965462424275,-0.09259049934397655,
    -0.7835527774719971,-0.17754713940884892,-0.45404037261630703,1.0,-0.28649716652306834,-0.9535965462424275,-0.09259049934397655,
    -0.9730125986940241,0.09448621673837887,-0.11989100382731,1.0,-0.5272277350824002,0.845561370252014,-0.08400526470060674,
    -0.9011113397818481,0.170042484895766,0.18936489627654907,1.0,-0.5272277350824002,0.845561370252014,-0.08400526470060674,
    -0.802130945372688,0.16864333906073758,-0.4459318678198053,1.0,-0.5272277350824002,0.845561370252014,-0.08400526470060674,
    -0.7298659404509493,-0.2035270599909702,-0.3525911319361019,1.0,-0.19649979710918214,-0.9799711690141055,-0.03231621322460108,
    -0.8080314480760549,-0.20308593818551368,0.10932003426870307,1.0,-0.19649979710918214,-0.9799711690141055,-0.03231621322460108,
    -0.9072423744956615,-0.17707570543592888,-0.07617048839283291,1.0,-0.19649979710918214,-0.9799711690141055,-0.03231621322460108,
    -0.8177417116164203,0.19579905266499775,-0.06626000500948448,1.0,0.17755353581165384,0.9839828565036043,0.015889620127211405,
    -0.6905845621726485,0.16885392885574757,0.1814701720295273,1.0,0.17755353581165384,0.9839828565036043,0.015889620127211405,
    -0.6390490913528959,0.16780975445548973,-0.32973495997996205,1.0,0.17755353581165384,0.9839828565036043,0.015889620127211405,
    -0.976441064371876,-0.0039182464889735424,0.23958497856610683,1.0,-0.9292684770737508,0.3584581017035433,0.08926302056352185,
    -0.9301886852655744,0.09682424207616003,0.31653640411543504,1.0,-0.9292684770737508,0.3584581017035433,0.08926302056352185,
    -0.9730125986940241,0.09448621673837887,-0.11989100382731,1.0,-0.9292684770737508,0.3584581017035433,0.08926302056352185,
    -0.6363967766998345,0.09095803998334406,-0.0039182464889735424,1.0,0.8964545474393675,0.44243002762027595,-0.02499830064625443,
    -0.5860658156924496,-0.0025398405579991623,0.14621791895802705,1.0,0.8964545474393675,0.44243002762027595,-0.02499830064625443,
    -0.5925398565117715,-0.006432561011213922,-0.1548401352241744,1.0,0.8964545474393675,0.44243002762027595,-0.02499830064625443,
    -0.9665481301381118,-0.1020211834189253,-0.20093536967283598,1.0,-0.9548627960700463,-0.293773529908825,0.04397901552106526,
    -0.9449539015747969,-0.10419727796736178,0.25337781245064295,1.0,-0.9548627960700463,-0.293773529908825,0.04397901552106526,
    -0.976441064371876,-0.0039182464889735424,0.23958497856610683,1.0,-0.9548627960700463,-0.293773529908825,0.04397901552106526,
    -0.8080314480760549,-0.20308593818551368,0.10932003426870307,1.0,-0.3578723246147835,-0.9317922138749598,0.06075088013199595,
    -0.8393104141439764,-0.17589512628208515,0.34211189656850305,1.0,-0.3578723246147835,-0.9317922138749598,0.06075088013199595,
    -0.9072423744956615,-0.17707570543592888,-0.07617048839283291,1.0,-0.3578723246147835,-0.9317922138749598,0.06075088013199595,
    -0.6905845621726485,0.16885392885574757,0.1814701720295273,1.0,0.5545414438940218,0.8125998530439096,-0.179346775373716,
    -0.5337151071056507,0.09680828830381083,0.3400809813484449,1.0,0.5545414438940218,0.8125998530439096,-0.179346775373716,
    -0.6363967766998345,0.09095803998334406,-0.0039182464889735424,1.0,0.5545414438940218,0.8125998530439096,-0.179346775373716,
    -0.4592428977793944,-0.0039182464889735424,0.39539031701741045,1.0,0.8486474701078833,-0.23535381869099412,-0.4737151586207222,
    -0.4777397014411042,-0.10326398228493117,0.4116113150535008,1.0,0.8486474701078833,-0.23535381869099412,-0.4737151586207222,
    -0.5973339651027183,-0.10358066466606353,0.197518869324246,1.0,0.8486474701078833,-0.23535381869099412,-0.4737151586207222,
    -0.5973339651027183,-0.10358066466606353,0.197518869324246,1.0,0.6182180968406196,-0.7065871192987383,-0.34429787623491553,
    -0.4777397014411042,-0.10326398228493117,0.4116113150535008,1.0,0.6182180968406196,-0.7065871192987383,-0.34429787623491553,
    -0.6912833374015452,-0.17669042183369466,0.17886412331627888,1.0,0.6182180968406196,-0.7065871192987383,-0.34429787623491553,
    -0.6912833374015452,-0.17669042183369466,0.17886412331627888,1.0,0.32531567541192735,-0.925295285477892,-0.19493164443893657,
    -0.45812852678079996,-0.20293278197096098,0.6925357085309607,1.0,0.32531567541192735,-0.925295285477892,-0.19493164443893657,
    -0.8080314480760549,-0.20308593818551368,0.10932003426870307,1.0,0.32531567541192735,-0.925295285477892,-0.19493164443893657,
    -0.8080314480760549,-0.20308593818551368,0.10932003426870307,1.0,-0.15605152305130315,-0.9832772163644681,0.093882042648802,
    -0.45812852678079996,-0.20293278197096098,0.6925357085309607,1.0,-0.15605152305130315,-0.9832772163644681,0.093882042648802,
    -0.8393104141439764,-0.17589512628208515,0.34211189656850305,1.0,-0.15605152305130315,-0.9832772163644681,0.093882042648802,
    -0.8415662775541591,-0.060115409589174384,0.5388003720419712,1.0,-0.809480092742644,0.27647639259071516,0.5179795206312555,
    -0.6972580251463361,0.09773919092038907,0.6800638469969416,1.0,-0.809480092742644,0.27647639259071516,0.5179795206312555,
    -0.9301886852655744,0.09682424207616003,0.31653640411543504,1.0,-0.809480092742644,0.27647639259071516,0.5179795206312555,
    -0.6972580251463361,0.09773919092038907,0.6800638469969416,1.0,-0.5943333161502837,0.7224320075597402,0.3533552090560011,
    -0.632499270114915,0.16935487730751375,0.6425684935331382,1.0,-0.5943333161502837,0.7224320075597402,0.3533552090560011,
    -0.9011113397818481,0.170042484895766,0.18936489627654907,1.0,-0.5943333161502837,0.7224320075597402,0.3533552090560011,
    -0.6292183768312936,0.19550390787653682,0.522279443085715,1.0,0.16706570399852508,0.9801523365104564,-0.10672604077998213,
    -0.4662665460561477,0.1681439859862064,0.5260907992999484,1.0,0.16706570399852508,0.9801523365104564,-0.10672604077998213,
    -0.6905845621726485,0.16885392885574757,0.1814701720295273,1.0,0.16706570399852508,0.9801523365104564,-0.10672604077998213,
    -0.6905845621726485,0.16885392885574757,0.1814701720295273,1.0,0.7105235251233463,0.5312922863235656,-0.4613944372653101,
    -0.4662665460561477,0.1681439859862064,0.5260907992999484,1.0,0.7105235251233463,0.5312922863235656,-0.4613944372653101,
    -0.5337151071056507,0.09680828830381083,0.3400809813484449,1.0,0.7105235251233463,0.5312922863235656,-0.4613944372653101,
    -0.4777397014411042,-0.10326398228493117,0.4116113150535008,1.0,0.7239192126184173,-0.4512622060236785,-0.5218269780459555,
    -0.38954964096035327,-0.17506154167683707,0.5960441026082823,1.0,0.7239192126184173,-0.4512622060236785,-0.5218269780459555,
    -0.6912833374015452,-0.17669042183369466,0.17886412331627888,1.0,0.7239192126184173,-0.4512622060236785,-0.5218269780459555,
    -0.8393104141439764,-0.17589512628208515,0.34211189656850305,1.0,-0.576395162871439,-0.7070944704495455,0.4096169260151293,
    -0.5997772853380046,-0.17800581036388963,0.6755289872066701,1.0,-0.576395162871439,-0.7070944704495455,0.4096169260151293,
    -0.8415662775541591,-0.060115409589174384,0.5388003720419712,1.0,-0.576395162871439,-0.7070944704495455,0.4096169260151293,
    -0.5997772853380046,-0.17800581036388963,0.6755289872066701,1.0,-0.5963592107290786,-0.5823108183353233,0.5525122646858045,
    -0.5475526115527647,-0.10419648027874429,0.8096882473345235,1.0,-0.5963592107290786,-0.5823108183353233,0.5525122646858045,
    -0.8415662775541591,-0.060115409589174384,0.5388003720419712,1.0,-0.5963592107290786,-0.5823108183353233,0.5525122646858045,
    -0.8415662775541591,-0.060115409589174384,0.5388003720419712,1.0,-0.6717318676850016,-0.28917933375640914,0.6820202422689658,
    -0.5475526115527647,-0.10419648027874429,0.8096882473345235,1.0,-0.6717318676850016,-0.28917933375640914,0.6820202422689658,
    -0.5646869630558493,-0.0039182464889735424,0.8353307456314583,1.0,-0.6717318676850016,-0.28917933375640914,0.6820202422689658,
    -0.3920280594948078,0.09604968642860445,0.8911011453213169,1.0,-0.33969908569997526,0.7607406874563453,0.553062507880482,
    -0.28088052060349933,0.16851570888194356,0.8596921560087487,1.0,-0.33969908569997526,0.7607406874563453,0.553062507880482,
    -0.632499270114915,0.16935487730751375,0.6425684935331382,1.0,-0.33969908569997526,0.7607406874563453,0.553062507880482,
    -0.632499270114915,0.16935487730751375,0.6425684935331382,1.0,-0.12579016930716436,0.9701224447981992,0.20745909332791312,
    -0.28088052060349933,0.16851570888194356,0.8596921560087487,1.0,-0.12579016930716436,0.9701224447981992,0.20745909332791312,
    -0.6292183768312936,0.19550390787653682,0.522279443085715,1.0,-0.12579016930716436,0.9701224447981992,0.20745909332791312,
    -0.29361960782436813,0.09536686497205693,0.5569366204485882,1.0,0.5235418287250138,0.37301348892198977,-0.7660058032792656,
    -0.22493383172918147,-0.0039182464889735424,0.5555334861704724,1.0,0.5235418287250138,0.37301348892198977,-0.7660058032792656,
    -0.4592428977793944,-0.0039182464889735424,0.39539031701741045,1.0,0.5235418287250138,0.37301348892198977,-0.7660058032792656,
    -0.4592428977793944,-0.0039182464889735424,0.39539031701741045,1.0,0.5397253320340323,-0.2917110741751863,-0.789684250295213,
    -0.22493383172918147,-0.0039182464889735424,0.5555334861704724,1.0,0.5397253320340323,-0.2917110741751863,-0.789684250295213,
    -0.2538811539682615,-0.10346340443929669,0.572521062967944,1.0,0.5397253320340323,-0.2917110741751863,-0.789684250295213,
    -0.21178313718170227,0.19550390787653682,0.7718443039448895,1.0,0.11249793898229694,0.9680133956749124,-0.2242638613746335,
    -0.15133987757075107,0.16843434464296259,0.6853214126746341,1.0,0.11249793898229694,0.9680133956749124,-0.2242638613746335,
    -0.4662665460561477,0.1681439859862064,0.5260907992999484,1.0,0.11249793898229694,0.9680133956749124,-0.2242638613746335,
    -0.45812852678079996,-0.20293278197096098,0.6925357085309607,1.0,-0.20662618987872813,-0.8737165665471476,0.4403691394696768,
    -0.1233856776604112,-0.1757523400195593,0.9035283362927582,1.0,-0.20662618987872813,-0.8737165665471476,0.4403691394696768,
    -0.5997772853380046,-0.17800581036388963,0.6755289872066701,1.0,-0.20662618987872813,-0.8737165665471476,0.4403691394696768,
    -0.5646869630558493,-0.0039182464889735424,0.8353307456314583,1.0,-0.3327602543366205,0.049355594074338704,0.9417189806239422,
    -0.12536155236586477,-0.006215589707264213,0.9906885807683656,1.0,-0.3327602543366205,0.049355594074338704,0.9417189806239422,
    -0.3920280594948078,0.09604968642860445,0.8911011453213169,1.0,-0.3327602543366205,0.049355594074338704,0.9417189806239422,
    -0.20465259863020913,-0.10370191333591794,0.9473732911515593,1.0,-0.33052415366379884,-0.14550263986266665,0.9325142173917912,
    -0.12536155236586477,-0.006215589707264213,0.9906885807683656,1.0,-0.33052415366379884,-0.14550263986266665,0.9325142173917912,
    -0.5646869630558493,-0.0039182464889735424,0.8353307456314583,1.0,-0.33052415366379884,-0.14550263986266665,0.9325142173917912,
    -0.014260279414368915,0.0956269114613495,0.6242990311274053,1.0,0.1301067864948069,0.36222832196528976,-0.9229641742094896,
    0.07530659162012143,-0.0039182464889735424,0.5978572488357736,1.0,0.1301067864948069,0.36222832196528976,-0.9229641742094896,
    -0.22493383172918147,-0.0039182464889735424,0.5555334861704724,1.0,0.1301067864948069,0.36222832196528976,-0.9229641742094896,
    -0.22493383172918147,-0.0039182464889735424,0.5555334861704724,1.0,0.13169286234849292,-0.33150888439702814,-0.9342156333375603,
    0.07530659162012143,-0.0039182464889735424,0.5978572488357736,1.0,0.13169286234849292,-0.33150888439702814,-0.9342156333375603,
    0.033979939726648034,-0.10466472349719458,0.6277817396312446,1.0,0.13169286234849292,-0.33150888439702814,-0.9342156333375603,
    0.033979939726648034,-0.10466472349719458,0.6277817396312446,1.0,0.16553290587896927,-0.6693816813506981,-0.7242423777599435,
    0.05411120736553765,-0.17683320809622038,0.699084732080324,1.0,0.16553290587896927,-0.6693816813506981,-0.7242423777599435,
    -0.38954964096035327,-0.17506154167683707,0.5960441026082823,1.0,0.16553290587896927,-0.6693816813506981,-0.7242423777599435,
    -0.38954964096035327,-0.17506154167683707,0.5960441026082823,1.0,0.05245909420078866,-0.9687248850450552,-0.24252863857713244,
    0.05411120736553765,-0.17683320809622038,0.699084732080324,1.0,0.05245909420078866,-0.9687248850450552,-0.24252863857713244,
    -0.45812852678079996,-0.20293278197096098,0.6925357085309607,1.0,0.05245909420078866,-0.9687248850450552,-0.24252863857713244,
    0.054924849755348726,0.09418469044097821,0.9769029260813866,1.0,-0.015756216378226592,0.8233662964816328,0.5672915330441327,
    0.24542166618007655,0.16953914337814746,0.8728245037180267,1.0,-0.015756216378226592,0.8233662964816328,0.5672915330441327,
    -0.28088052060349933,0.16851570888194356,0.8596921560087487,1.0,-0.015756216378226592,0.8233662964816328,0.5672915330441327,
    0.24542166618007655,0.16953914337814746,0.8728245037180267,1.0,0.012201989709785229,0.9803614736744584,0.19683112655768265,
    0.38011218692715976,0.19550390787653682,0.7351514252302529,1.0,0.012201989709785229,0.9803614736744584,0.19683112655768265,
    -0.21178313718170227,0.19550390787653682,0.7718443039448895,1.0,0.012201989709785229,0.9803614736744584,0.19683112655768265,
    -0.21178313718170227,0.19550390787653682,0.7718443039448895,1.0,-0.019265085888278372,0.9502910574021347,-0.3107664117745834,
    0.38011218692715976,0.19550390787653682,0.7351514252302529,1.0,-0.019265085888278372,0.9502910574021347,-0.3107664117745834,
    -0.15133987757075107,0.16843434464296259,0.6853214126746341,1.0,-0.019265085888278372,0.9502910574021347,-0.3107664117745834,
    0.05411120736553765,-0.17683320809622038,0.699084732080324,1.0,0.0516985581500355,-0.9132606054630641,-0.40408207779415933,
    0.20601345541159932,-0.20383975392901532,0.779556357498512,1.0,0.0516985581500355,-0.9132606054630641,-0.40408207779415933,
    -0.45812852678079996,-0.20293278197096098,0.6925357085309607,1.0,0.0516985581500355,-0.9132606054630641,-0.40408207779415933,
    0.38011218692715976,0.19550390787653682,0.7351514252302529,1.0,-0.01350527114940558,0.931982803870895,-0.36225082600337255,
    0.1781047237524549,0.16935248424166138,0.6754013570278761,1.0,-0.01350527114940558,0.931982803870895,-0.36225082600337255,
    -0.15133987757075107,0.16843434464296259,0.6853214126746341,1.0,-0.01350527114940558,0.931982803870895,-0.36225082600337255,
    0.11907018223994137,-0.10225809693831156,0.9656371697369701,1.0,0.09329638930326022,-0.022191753545952923,0.9953910336232341,
    0.3281762764214411,-0.00046664784121530634,0.9483073845226073,1.0,0.09329638930326022,-0.022191753545952923,0.9953910336232341,
    -0.12536155236586477,-0.006215589707264213,0.9906885807683656,1.0,0.09329638930326022,-0.022191753545952923,0.9953910336232341,
    -0.1233856776604112,-0.1757523400195593,0.9035283362927582,1.0,0.10237025341847962,-0.8171280922005816,0.567293585501964,
    0.39578357750581916,-0.17800581036388963,0.8065964062532405,1.0,0.10237025341847962,-0.8171280922005816,0.567293585501964,
    0.11907018223994137,-0.10225809693831156,0.9656371697369701,1.0,0.10237025341847962,-0.8171280922005816,0.567293585501964,
    0.3281762764214411,-0.00046664784121530634,0.9483073845226073,1.0,0.2587774765757035,0.49680481202825905,0.8283834838784978,
    0.4773073542104398,0.09773839323177169,0.8428242325038966,1.0,0.2587774765757035,0.49680481202825905,0.8283834838784978,
    0.054924849755348726,0.09418469044097821,0.9769029260813866,1.0,0.2587774765757035,0.49680481202825905,0.8283834838784978,
    0.07530659162012143,-0.0039182464889735424,0.5978572488357736,1.0,-0.34727023939131124,-0.13326352109481124,-0.9282479274302281,
    0.38836028723171734,-0.10056619938067457,0.4946148041435139,1.0,-0.34727023939131124,-0.13326352109481124,-0.9282479274302281,
    0.033979939726648034,-0.10466472349719458,0.6277817396312446,1.0,-0.34727023939131124,-0.13326352109481124,-0.9282479274302281,
    0.38836028723171734,-0.10056619938067457,0.4946148041435139,1.0,-0.25383953388524666,-0.6939485021262127,-0.6737959390154458,
    0.4250037092520711,-0.17566698733749098,0.558157084033305,1.0,-0.25383953388524666,-0.6939485021262127,-0.6737959390154458,
    0.05411120736553765,-0.17683320809622038,0.699084732080324,1.0,-0.25383953388524666,-0.6939485021262127,-0.6737959390154458,
    0.11907018223994137,-0.10225809693831156,0.9656371697369701,1.0,0.28820587944027415,-0.44796480420241075,0.8463243499108093,
    0.4828002380302834,-0.10730267975514152,0.839103015103436,1.0,0.28820587944027415,-0.44796480420241075,0.8463243499108093,
    0.3281762764214411,-0.00046664784121530634,0.9483073845226073,1.0,0.28820587944027415,-0.44796480420241075,0.8463243499108093,
    0.1781047237524549,0.16935248424166138,0.6754013570278761,1.0,-0.37728678834047236,0.5908531502106203,-0.713124977987672,
    0.4584300530782006,0.1681439859862064,0.5260907992999484,1.0,-0.37728678834047236,0.5908531502106203,-0.713124977987672,
    0.27283583089639474,0.09682823051924738,0.5651934953279378,1.0,-0.37728678834047236,0.5908531502106203,-0.713124977987672,
    0.3281762764214411,-0.00046664784121530634,0.9483073845226073,1.0,0.5336885808713926,0.09246688781205535,0.8406107144843159,
    0.6938710392765921,0.05014908800260365,0.7105666620400726,1.0,0.5336885808713926,0.09246688781205535,0.8406107144843159,
    0.4773073542104398,0.09773839323177169,0.8428242325038966,1.0,0.5336885808713926,0.09246688781205535,0.8406107144843159,
    0.4773073542104398,0.09773839323177169,0.8428242325038966,1.0,0.3169818903257022,0.8386358540805464,0.44295867240199405,
    0.7559583351281327,0.1714767290299628,0.503815344657321,1.0,0.3169818903257022,0.8386358540805464,0.44295867240199405,
    0.24542166618007655,0.16953914337814746,0.8728245037180267,1.0,0.3169818903257022,0.8386358540805464,0.44295867240199405,
    0.20601345541159932,-0.20383975392901532,0.779556357498512,1.0,0.11217155670882048,-0.9821344459964555,0.15109424824511158,
    0.7102898640898134,-0.20334040085448402,0.4084301328470623,1.0,0.11217155670882048,-0.9821344459964555,0.15109424824511158,
    0.39578357750581916,-0.17800581036388963,0.8065964062532405,1.0,0.11217155670882048,-0.9821344459964555,0.15109424824511158,
    0.4828002380302834,-0.10730267975514152,0.839103015103436,1.0,0.5496613384113366,-0.056430277317338476,0.833479475966713,
    0.6938710392765921,0.05014908800260365,0.7105666620400726,1.0,0.5496613384113366,-0.056430277317338476,0.833479475966713,
    0.3281762764214411,-0.00046664784121530634,0.9483073845226073,1.0,0.5496613384113366,-0.056430277317338476,0.833479475966713,
    0.27283583089639474,0.09682823051924738,0.5651934953279378,1.0,-0.6217074538600891,0.15218951917431553,-0.7683216722625335,
    0.46949080344792926,0.09509644853073729,0.40572197999077875,1.0,-0.6217074538600891,0.15218951917431553,-0.7683216722625335,
    0.3543635960441025,-0.0039182464889735424,0.47926727514354406,1.0,-0.6217074538600891,0.15218951917431553,-0.7683216722625335,
    0.7102898640898134,-0.20334040085448402,0.4084301328470623,1.0,0.2316479385799801,-0.941983456028177,0.2429123321712126,
    0.6941558141130262,-0.14951875445708518,0.6325295822823784,1.0,0.2316479385799801,-0.941983456028177,0.2429123321712126,
    0.39578357750581916,-0.17800581036388963,0.8065964062532405,1.0,0.2316479385799801,-0.941983456028177,0.2429123321712126,
    0.6941558141130262,-0.14951875445708518,0.6325295822823784,1.0,0.7275567925026157,-0.24883444618306091,0.6393297522218679,
    0.8632665987035963,-0.0039182464889735424,0.49675101426107715,1.0,0.7275567925026157,-0.24883444618306091,0.6393297522218679,
    0.6938710392765921,0.05014908800260365,0.7105666620400726,1.0,0.7275567925026157,-0.24883444618306091,0.6393297522218679,
    0.7559583351281327,0.1714767290299628,0.503815344657321,1.0,0.10804725218857165,0.9914940574709245,0.07256256124436432,
    0.8156158714508839,0.19550390787653682,0.08667684517342544,1.0,0.10804725218857165,0.9914940574709245,0.07256256124436432,
    0.38011218692715976,0.19550390787653682,0.7351514252302529,1.0,0.10804725218857165,0.9914940574709245,0.07256256124436432,
    0.38011218692715976,0.19550390787653682,0.7351514252302529,1.0,-0.44643369048154924,0.8430936475674777,-0.2998167130671502,
    0.8156158714508839,0.19550390787653682,0.08667684517342544,1.0,-0.44643369048154924,0.8430936475674777,-0.2998167130671502,
    0.6451003572049627,0.16899910818412556,0.26604590538455763,1.0,-0.44643369048154924,0.8430936475674777,-0.2998167130671502,
    0.6451003572049627,0.16899910818412556,0.26604590538455763,1.0,-0.5846925127490529,0.7332194245548281,-0.34716558151793414,
    0.5928517527611992,0.09542748930698397,0.19865796866998187,1.0,-0.5846925127490529,0.7332194245548281,-0.34716558151793414,
    0.46949080344792926,0.09509644853073729,0.40572197999077875,1.0,-0.5846925127490529,0.7332194245548281,-0.34716558151793414,
    0.46949080344792926,0.09509644853073729,0.40572197999077875,1.0,-0.8506721136389089,0.14049880005102644,-0.5065738270591296,
    0.5928517527611992,0.09542748930698397,0.19865796866998187,1.0,-0.8506721136389089,0.14049880005102644,-0.5065738270591296,
    0.5177294272117112,-0.0039182464889735424,0.2972546748541425,1.0,-0.8506721136389089,0.14049880005102644,-0.5065738270591296,
    0.5177294272117112,-0.0039182464889735424,0.2972546748541425,1.0,-0.8215596241172228,-0.05839053275090152,-0.5671246156758084,
    0.5928517527611992,-0.10326398228493117,0.19865796866998187,1.0,-0.8215596241172228,-0.05839053275090152,-0.5671246156758084,
    0.38836028723171734,-0.10056619938067457,0.4946148041435139,1.0,-0.8215596241172228,-0.05839053275090152,-0.5671246156758084,
    0.38836028723171734,-0.10056619938067457,0.4946148041435139,1.0,-0.6101628868039148,-0.6746173317886351,-0.41544278452934474,
    0.5928517527611992,-0.10326398228493117,0.19865796866998187,1.0,-0.6101628868039148,-0.6746173317886351,-0.41544278452934474,
    0.6772831044764691,-0.17621499941768726,0.1931148304672381,1.0,-0.6101628868039148,-0.6746173317886351,-0.41544278452934474,
    0.7102898640898134,-0.20334040085448402,0.4084301328470623,1.0,0.4000440595164308,-0.8841988376659983,0.24115796879993853,
    0.8747788408308088,-0.17785185646071933,0.229021188205057,1.0,0.4000440595164308,-0.8841988376659983,0.24115796879993853,
    0.6941558141130262,-0.14951875445708518,0.6325295822823784,1.0,0.4000440595164308,-0.8841988376659983,0.24115796879993853,
    0.6941558141130262,-0.14951875445708518,0.6325295822823784,1.0,0.5835658342916136,-0.7489806527076559,0.31381347790868813,
    0.8747788408308088,-0.17785185646071933,0.229021188205057,1.0,0.5835658342916136,-0.7489806527076559,0.31381347790868813,
    0.9247604142237453,-0.1020211834189253,0.31706128322572513,1.0,0.5835658342916136,-0.7489806527076559,0.31381347790868813,
    0.5928517527611992,0.09542748930698397,0.19865796866998187,1.0,-0.8777676101734312,0.3957129995732887,-0.2700652597042679,
    0.5982489139469473,-0.0039182464889735424,0.03554979092581334,1.0,-0.8777676101734312,0.3957129995732887,-0.2700652597042679,
    0.5177294272117112,-0.0039182464889735424,0.2972546748541425,1.0,-0.8777676101734312,0.3957129995732887,-0.2700652597042679,
    0.5177294272117112,-0.0039182464889735424,0.2972546748541425,1.0,-0.8777676101734313,-0.39571299957328826,-0.2700652597042679,
    0.5982489139469473,-0.0039182464889735424,0.03554979092581334,1.0,-0.8777676101734313,-0.39571299957328826,-0.2700652597042679,
    0.5928517527611992,-0.10326398228493117,0.19865796866998187,1.0,-0.8777676101734313,-0.39571299957328826,-0.2700652597042679,
    1.0,-0.0039182464889735424,0.08069976436278248,1.0,0.8925825792214835,0.4182617441086687,0.16838483508172117,
    0.9720226671197536,0.09448621673837887,-0.015429690927568407,1.0,0.8925825792214835,0.4182617441086687,0.16838483508172117,
    0.8985778807327887,0.09608957085947756,0.3699073564439679,1.0,0.8925825792214835,0.4182617441086687,0.16838483508172117,
    0.8985778807327887,0.09608957085947756,0.3699073564439679,1.0,0.6817701759971141,0.720467862264879,0.12694678634900278,
    0.9720226671197536,0.09448621673837887,-0.015429690927568407,1.0,0.6817701759971141,0.720467862264879,0.12694678634900278,
    0.9033680008806482,0.167903084023733,-0.06338513523215128,1.0,0.6817701759971141,0.720467862264879,0.12694678634900278,
    0.7559583351281327,0.1714767290299628,0.503815344657321,1.0,0.47635731528000924,0.8712555256492563,0.11831110347241217,
    0.9033680008806482,0.167903084023733,-0.06338513523215128,1.0,0.47635731528000924,0.8712555256492563,0.11831110347241217,
    0.8156158714508839,0.19550390787653682,0.08667684517342544,1.0,0.47635731528000924,0.8712555256492563,0.11831110347241217,
    0.6451003572049627,0.16899910818412556,0.26604590538455763,1.0,-0.759548200781485,0.6409371705113402,-0.11084256468760682,
    0.6964954348280423,0.16727131463870282,-0.09612945529035077,1.0,-0.759548200781485,0.6409371705113402,-0.11084256468760682,
    0.5928517527611992,0.09542748930698397,0.19865796866998187,1.0,-0.759548200781485,0.6409371705113402,-0.11084256468760682,
    0.7102898640898134,-0.20334040085448402,0.4084301328470623,1.0,0.1739818538712603,-0.9845530227166492,0.01963822759387413,
    0.7809108327709628,-0.2030994988920105,-0.20514796326165308,1.0,0.1739818538712603,-0.9845530227166492,0.01963822759387413,
    0.8747788408308088,-0.17785185646071933,0.229021188205057,1.0,0.1739818538712603,-0.9845530227166492,0.01963822759387413,
    0.9247604142237453,-0.1020211834189253,0.31706128322572513,1.0,0.8552614436129101,-0.5148786629859976,0.05854763420422987,
    0.9565403287434329,-0.10661427447827176,-0.18757089457587706,1.0,0.8552614436129101,-0.5148786629859976,0.05854763420422987,
    1.0,-0.0039182464889735424,0.08069976436278248,1.0,0.8552614436129101,-0.5148786629859976,0.05854763420422987
  ])
  var colors = [
    .208, .447, .729,
    .176, .89, .282,
    .498, .141, .98,
    .498, .141, .98,
    .176, .89, .282,
    .208, .447, .729
  ];
  var colors_start = 0;
  for (i = 0; i < torusVerts.length; i+=7) {
    torusVerts[i+3] = 1.0;
    torusVerts[i+4] = colors[colors_start]
    torusVerts[i+5] = colors[colors_start + 1];
    torusVerts[i+6] = colors[colors_start + 2];
    if (colors_start == 15) {
      colors_start = 0;
    }
    else {
      colors_start += 3;
    }
  }
  torLen = torusVerts.length/7;
};
function initIso() {
  isoVerts = new Float32Array([
    0.0,-1.0,0.0,1.0,0.10238080664853444,-0.9435231855805403,0.3150907309045204,
    0.4253230000000001,-0.850654,0.3090109999999999,1.0,0.10238080664853444,-0.9435231855805403,0.3150907309045204,
    -0.16245599999999993,-0.850654,0.49999499999999997,1.0,0.10238080664853444,-0.9435231855805403,0.3150907309045204,
    0.7236069999999999,-0.44721999999999995,0.525725,1.0,0.7002238399407358,-0.6616989163236974,0.26803193487846794,
    0.4253230000000001,-0.850654,0.3090109999999999,1.0,0.7002238399407358,-0.6616989163236974,0.26803193487846794,
    0.8506480000000001,-0.525736,0.0,1.0,0.7002238399407358,-0.6616989163236974,0.26803193487846794,
    0.0,-1.0,0.0,1.0,-0.268033501534074,-0.9435228644609148,0.19473737775489808,
    -0.16245599999999993,-0.850654,0.49999499999999997,1.0,-0.268033501534074,-0.9435228644609148,0.19473737775489808,
    -0.52573,-0.850652,0.0,1.0,-0.268033501534074,-0.9435228644609148,0.19473737775489808,
    0.0,-1.0,0.0,1.0,-0.268033501534074,-0.9435228644609148,-0.19473737775489805,
    -0.52573,-0.850652,0.0,1.0,-0.268033501534074,-0.9435228644609148,-0.19473737775489805,
    -0.16245599999999993,-0.850654,-0.49999499999999997,1.0,-0.268033501534074,-0.9435228644609148,-0.19473737775489805,
    0.0,-1.0,0.0,1.0,0.10238080664853444,-0.9435231855805403,-0.3150907309045204,
    -0.16245599999999993,-0.850654,-0.49999499999999997,1.0,0.10238080664853444,-0.9435231855805403,-0.3150907309045204,
    0.4253230000000001,-0.850654,-0.3090109999999999,1.0,0.10238080664853444,-0.9435231855805403,-0.3150907309045204,
    0.7236069999999999,-0.44721999999999995,0.525725,1.0,0.90498867587926,-0.33038505727300543,0.2680321071457978,
    0.8506480000000001,-0.525736,0.0,1.0,0.90498867587926,-0.33038505727300543,0.2680321071457978,
    0.951058,0.0,0.309013,1.0,0.90498867587926,-0.33038505727300543,0.2680321071457978,
    -0.2763880000000001,-0.44721999999999995,0.850649,1.0,0.02474544913102927,-0.3303859849884663,0.943521469639406,
    0.262869,-0.525738,0.8090120000000001,1.0,0.02474544913102927,-0.3303859849884663,0.943521469639406,
    0.0,0.0,1.0,1.0,0.02474544913102927,-0.3303859849884663,0.943521469639406,
    -0.894426,-0.44721600000000006,0.0,1.0,-0.8896968564009531,-0.33038564812615445,0.3150949495350927,
    -0.688189,-0.525736,0.499997,1.0,-0.8896968564009531,-0.33038564812615445,0.3150949495350927,
    -0.951058,0.0,0.309013,1.0,-0.8896968564009531,-0.33038564812615445,0.3150949495350927,
    -0.2763880000000001,-0.44721999999999995,-0.850649,1.0,-0.574601616258777,-0.3303887402374517,-0.7487831881907544,
    -0.688189,-0.525736,-0.499997,1.0,-0.574601616258777,-0.3303887402374517,-0.7487831881907544,
    -0.587786,0.0,-0.809017,1.0,-0.574601616258777,-0.3303887402374517,-0.7487831881907544,
    0.7236069999999999,-0.44721999999999995,-0.525725,1.0,0.5345770668995847,-0.3303871246962902,-0.7778635531890891,
    0.262869,-0.525738,-0.809012,1.0,0.5345770668995847,-0.3303871246962902,-0.7778635531890891,
    0.5877859999999999,0.0,-0.809017,1.0,0.5345770668995847,-0.3303871246962902,-0.7778635531890891,
    0.7236069999999999,-0.44721999999999995,0.525725,1.0,0.8026090457801579,-0.12562900142829422,0.5831261215483268,
    0.951058,0.0,0.309013,1.0,0.8026090457801579,-0.12562900142829422,0.5831261215483268,
    0.5877859999999999,0.0,0.8090169999999999,1.0,0.8026090457801579,-0.12562900142829422,0.5831261215483268,
    -0.2763880000000001,-0.44721999999999995,0.850649,1.0,-0.3065683577050717,-0.12562962647955508,0.943521615547107,
    0.0,0.0,1.0,1.0,-0.3065683577050717,-0.12562962647955508,0.943521615547107,
    -0.587786,0.0,0.8090169999999999,1.0,-0.3065683577050717,-0.12562962647955508,0.943521615547107,
    -0.894426,-0.44721600000000006,0.0,1.0,-0.9920772862993613,-0.1256290492238769,-0.0,
    -0.951058,0.0,0.309013,1.0,-0.9920772862993613,-0.1256290492238769,-0.0,
    -0.951058,0.0,-0.309013,1.0,-0.9920772862993613,-0.1256290492238769,-0.0,
    -0.2763880000000001,-0.44721999999999995,-0.850649,1.0,-0.30656835770507146,-0.1256296264795552,-0.943521615547107,
    -0.587786,0.0,-0.809017,1.0,-0.30656835770507146,-0.1256296264795552,-0.943521615547107,
    0.0,0.0,-1.0,1.0,-0.30656835770507146,-0.1256296264795552,-0.943521615547107,
    0.7236069999999999,-0.44721999999999995,-0.525725,1.0,0.802609045780158,-0.12562900142829433,-0.5831261215483268,
    0.5877859999999999,0.0,-0.809017,1.0,0.802609045780158,-0.12562900142829433,-0.5831261215483268,
    0.951058,0.0,-0.309013,1.0,0.802609045780158,-0.12562900142829433,-0.5831261215483268,
    0.2763880000000001,0.44721999999999995,0.850649,1.0,0.4089462884826101,0.6616986930009953,0.628424834659701,
    0.6881889999999999,0.525736,0.499997,1.0,0.4089462884826101,0.6616986930009953,0.628424834659701,
    0.16245599999999993,0.850654,0.49999499999999997,1.0,0.4089462884826101,0.6616986930009953,0.628424834659701,
    -0.723607,0.44721999999999995,0.525725,1.0,-0.4713003065101048,0.6616990252663818,0.583121274731939,
    -0.262869,0.525738,0.8090120000000001,1.0,-0.4713003065101048,0.6616990252663818,0.583121274731939,
    -0.425323,0.850654,0.3090109999999999,1.0,-0.4713003065101048,0.6616990252663818,0.583121274731939,
    -0.723607,0.44721999999999995,-0.525725,1.0,-0.7002238399407358,0.6616989163236976,-0.2680319348784677,
    -0.850648,0.525736,0.0,1.0,-0.7002238399407358,0.6616989163236976,-0.2680319348784677,
    -0.425323,0.850654,-0.3090109999999999,1.0,-0.7002238399407358,0.6616989163236976,-0.2680319348784677,
    0.2763880000000001,0.44721999999999995,-0.850649,1.0,0.038531614700113834,0.6616995666277691,-0.7487783371554124,
    -0.262869,0.525738,-0.809012,1.0,0.038531614700113834,0.6616995666277691,-0.7487783371554124,
    0.16245599999999993,0.850654,-0.49999499999999997,1.0,0.038531614700113834,0.6616995666277691,-0.7487783371554124,
    0.8944260000000002,0.44721600000000006,0.0,1.0,0.7240423570113704,0.661694843446456,-0.19473725737462122,
    0.6881889999999999,0.525736,-0.499997,1.0,0.7240423570113704,0.661694843446456,-0.19473725737462122,
    0.52573,0.850652,0.0,1.0,0.7240423570113704,0.661694843446456,-0.19473725737462122,
    0.52573,0.850652,0.0,1.0,0.268033501534074,0.9435228644609148,-0.19473737775489808,
    0.16245599999999993,0.850654,-0.49999499999999997,1.0,0.268033501534074,0.9435228644609148,-0.19473737775489808,
    0.0,1.0,0.0,1.0,0.268033501534074,0.9435228644609148,-0.19473737775489808,
    0.52573,0.850652,0.0,1.0,0.49111934406566665,0.7946569896343344,-0.35682216678593126,
    0.6881889999999999,0.525736,-0.499997,1.0,0.49111934406566665,0.7946569896343344,-0.35682216678593126,
    0.16245599999999993,0.850654,-0.49999499999999997,1.0,0.49111934406566665,0.7946569896343344,-0.35682216678593126,
    0.6881889999999999,0.525736,-0.499997,1.0,0.40894628848261005,0.6616986930009953,-0.6284248346597009,
    0.2763880000000001,0.44721999999999995,-0.850649,1.0,0.40894628848261005,0.6616986930009953,-0.6284248346597009,
    0.16245599999999993,0.850654,-0.49999499999999997,1.0,0.40894628848261005,0.6616986930009953,-0.6284248346597009,
    0.16245599999999993,0.850654,-0.49999499999999997,1.0,-0.10238080664853445,0.9435231855805403,-0.3150907309045204,
    -0.425323,0.850654,-0.3090109999999999,1.0,-0.10238080664853445,0.9435231855805403,-0.3150907309045204,
    0.0,1.0,0.0,1.0,-0.10238080664853445,0.9435231855805403,-0.3150907309045204,
    0.16245599999999993,0.850654,-0.49999499999999997,1.0,-0.18759344736740524,0.7946587120980675,-0.5773441173091256,
    -0.262869,0.525738,-0.809012,1.0,-0.18759344736740524,0.7946587120980675,-0.5773441173091256,
    -0.425323,0.850654,-0.3090109999999999,1.0,-0.18759344736740524,0.7946587120980675,-0.5773441173091256,
    -0.262869,0.525738,-0.809012,1.0,-0.4713003065101047,0.6616990252663819,-0.583121274731939,
    -0.723607,0.44721999999999995,-0.525725,1.0,-0.4713003065101047,0.6616990252663819,-0.583121274731939,
    -0.425323,0.850654,-0.3090109999999999,1.0,-0.4713003065101047,0.6616990252663819,-0.583121274731939,
    -0.425323,0.850654,-0.3090109999999999,1.0,-0.33130469843931526,0.9435238188790118,0.0,
    -0.425323,0.850654,0.3090109999999999,1.0,-0.33130469843931526,0.9435238188790118,0.0,
    0.0,1.0,0.0,1.0,-0.33130469843931526,0.9435238188790118,0.0,
    -0.425323,0.850654,-0.3090109999999999,1.0,-0.6070603612443728,0.794655722817027,0.0,
    -0.850648,0.525736,0.0,1.0,-0.6070603612443728,0.794655722817027,0.0,
    -0.425323,0.850654,0.3090109999999999,1.0,-0.6070603612443728,0.794655722817027,0.0,
    -0.850648,0.525736,0.0,1.0,-0.7002238399407356,0.6616989163236975,0.26803193487846766,
    -0.723607,0.44721999999999995,0.525725,1.0,-0.7002238399407356,0.6616989163236975,0.26803193487846766,
    -0.425323,0.850654,0.3090109999999999,1.0,-0.7002238399407356,0.6616989163236975,0.26803193487846766,
    -0.425323,0.850654,0.3090109999999999,1.0,-0.10238080664853445,0.9435231855805403,0.3150907309045204,
    0.16245599999999993,0.850654,0.49999499999999997,1.0,-0.10238080664853445,0.9435231855805403,0.3150907309045204,
    0.0,1.0,0.0,1.0,-0.10238080664853445,0.9435231855805403,0.3150907309045204,
    -0.425323,0.850654,0.3090109999999999,1.0,-0.1875934473674052,0.7946587120980675,0.5773441173091256,
    -0.262869,0.525738,0.8090120000000001,1.0,-0.1875934473674052,0.7946587120980675,0.5773441173091256,
    0.16245599999999993,0.850654,0.49999499999999997,1.0,-0.1875934473674052,0.7946587120980675,0.5773441173091256,
    -0.262869,0.525738,0.8090120000000001,1.0,0.03853161470011399,0.6616995666277691,0.7487783371554125,
    0.2763880000000001,0.44721999999999995,0.850649,1.0,0.03853161470011399,0.6616995666277691,0.7487783371554125,
    0.16245599999999993,0.850654,0.49999499999999997,1.0,0.03853161470011399,0.6616995666277691,0.7487783371554125,
    0.16245599999999993,0.850654,0.49999499999999997,1.0,0.268033501534074,0.9435228644609148,0.19473737775489805,
    0.52573,0.850652,0.0,1.0,0.268033501534074,0.9435228644609148,0.19473737775489805,
    0.0,1.0,0.0,1.0,0.268033501534074,0.9435228644609148,0.19473737775489805,
    0.16245599999999993,0.850654,0.49999499999999997,1.0,0.49111934406566665,0.7946569896343344,0.35682216678593126,
    0.6881889999999999,0.525736,0.499997,1.0,0.49111934406566665,0.7946569896343344,0.35682216678593126,
    0.52573,0.850652,0.0,1.0,0.49111934406566665,0.7946569896343344,0.35682216678593126,
    0.6881889999999999,0.525736,0.499997,1.0,0.7240423570113704,0.6616948434464559,0.19473725737462125,
    0.8944260000000002,0.44721600000000006,0.0,1.0,0.7240423570113704,0.6616948434464559,0.19473725737462125,
    0.52573,0.850652,0.0,1.0,0.7240423570113704,0.6616948434464559,0.19473725737462125,
    0.951058,0.0,-0.309013,1.0,0.8896968564009529,0.3303856481261544,-0.315094949535093,
    0.6881889999999999,0.525736,-0.499997,1.0,0.8896968564009529,0.3303856481261544,-0.315094949535093,
    0.8944260000000002,0.44721600000000006,0.0,1.0,0.8896968564009529,0.3303856481261544,-0.315094949535093,
    0.951058,0.0,-0.309013,1.0,0.7946555146913548,0.1875963425615708,-0.5773475774852959,
    0.5877859999999999,0.0,-0.809017,1.0,0.7946555146913548,0.1875963425615708,-0.5773475774852959,
    0.6881889999999999,0.525736,-0.499997,1.0,0.7946555146913548,0.1875963425615708,-0.5773475774852959,
    0.5877859999999999,0.0,-0.809017,1.0,0.5746016162587771,0.3303887402374517,-0.7487831881907545,
    0.2763880000000001,0.44721999999999995,-0.850649,1.0,0.5746016162587771,0.3303887402374517,-0.7487831881907545,
    0.6881889999999999,0.525736,-0.499997,1.0,0.5746016162587771,0.3303887402374517,-0.7487831881907545,
    0.0,0.0,-1.0,1.0,-0.02474544913102945,0.3303859849884664,-0.943521469639406,
    -0.262869,0.525738,-0.809012,1.0,-0.02474544913102945,0.3303859849884664,-0.943521469639406,
    0.2763880000000001,0.44721999999999995,-0.850649,1.0,-0.02474544913102945,0.3303859849884664,-0.943521469639406,
    0.0,0.0,-1.0,1.0,-0.3035303770456041,0.18759695965828635,-0.9341716603159832,
    -0.587786,0.0,-0.809017,1.0,-0.3035303770456041,0.18759695965828635,-0.9341716603159832,
    -0.262869,0.525738,-0.809012,1.0,-0.3035303770456041,0.18759695965828635,-0.9341716603159832,
    -0.587786,0.0,-0.809017,1.0,-0.5345770668995846,0.33038712469629034,-0.7778635531890892,
    -0.723607,0.44721999999999995,-0.525725,1.0,-0.5345770668995846,0.33038712469629034,-0.7778635531890892,
    -0.262869,0.525738,-0.809012,1.0,-0.5345770668995846,0.33038712469629034,-0.7778635531890892,
    -0.951058,0.0,-0.309013,1.0,-0.9049886758792601,0.33038505727300554,-0.2680321071457975,
    -0.850648,0.525736,0.0,1.0,-0.9049886758792601,0.33038505727300554,-0.2680321071457975,
    -0.723607,0.44721999999999995,-0.525725,1.0,-0.9049886758792601,0.33038505727300554,-0.2680321071457975,
    -0.951058,0.0,-0.309013,1.0,-0.9822457901368378,0.18759852813510944,0.0,
    -0.951058,0.0,0.309013,1.0,-0.9822457901368378,0.18759852813510944,0.0,
    -0.850648,0.525736,0.0,1.0,-0.9822457901368378,0.18759852813510944,0.0,
    -0.951058,0.0,0.309013,1.0,-0.9049886758792601,0.33038505727300554,0.2680321071457975,
    -0.723607,0.44721999999999995,0.525725,1.0,-0.9049886758792601,0.33038505727300554,0.2680321071457975,
    -0.850648,0.525736,0.0,1.0,-0.9049886758792601,0.33038505727300554,0.2680321071457975,
    -0.587786,0.0,0.8090169999999999,1.0,-0.5345770668995847,0.33038712469629006,0.7778635531890891,
    -0.262869,0.525738,0.8090120000000001,1.0,-0.5345770668995847,0.33038712469629006,0.7778635531890891,
    -0.723607,0.44721999999999995,0.525725,1.0,-0.5345770668995847,0.33038712469629006,0.7778635531890891,
    -0.587786,0.0,0.8090169999999999,1.0,-0.30353037704560426,0.18759695965828604,0.9341716603159832,
    0.0,0.0,1.0,1.0,-0.30353037704560426,0.18759695965828604,0.9341716603159832,
    -0.262869,0.525738,0.8090120000000001,1.0,-0.30353037704560426,0.18759695965828604,0.9341716603159832,
    0.0,0.0,1.0,1.0,-0.02474544913102927,0.3303859849884663,0.943521469639406,
    0.2763880000000001,0.44721999999999995,0.850649,1.0,-0.02474544913102927,0.3303859849884663,0.943521469639406,
    -0.262869,0.525738,0.8090120000000001,1.0,-0.02474544913102927,0.3303859849884663,0.943521469639406,
    0.5877859999999999,0.0,0.8090169999999999,1.0,0.5746016162587773,0.33038874023745146,0.7487831881907545,
    0.6881889999999999,0.525736,0.499997,1.0,0.5746016162587773,0.33038874023745146,0.7487831881907545,
    0.2763880000000001,0.44721999999999995,0.850649,1.0,0.5746016162587773,0.33038874023745146,0.7487831881907545,
    0.5877859999999999,0.0,0.8090169999999999,1.0,0.7946555146913548,0.18759634256157073,0.577347577485296,
    0.951058,0.0,0.309013,1.0,0.7946555146913548,0.18759634256157073,0.577347577485296,
    0.6881889999999999,0.525736,0.499997,1.0,0.7946555146913548,0.18759634256157073,0.577347577485296,
    0.951058,0.0,0.309013,1.0,0.889696856400953,0.33038564812615445,0.3150949495350931,
    0.8944260000000002,0.44721600000000006,0.0,1.0,0.889696856400953,0.33038564812615445,0.3150949495350931,
    0.6881889999999999,0.525736,0.499997,1.0,0.889696856400953,0.33038564812615445,0.3150949495350931,
    0.5877859999999999,0.0,-0.809017,1.0,0.3065683577050715,0.12562962647955517,-0.9435216155471069,
    0.0,0.0,-1.0,1.0,0.3065683577050715,0.12562962647955517,-0.9435216155471069,
    0.2763880000000001,0.44721999999999995,-0.850649,1.0,0.3065683577050715,0.12562962647955517,-0.9435216155471069,
    0.5877859999999999,0.0,-0.809017,1.0,0.3035303770456041,-0.18759695965828632,-0.9341716603159832,
    0.262869,-0.525738,-0.809012,1.0,0.3035303770456041,-0.18759695965828632,-0.9341716603159832,
    0.0,0.0,-1.0,1.0,0.3035303770456041,-0.18759695965828632,-0.9341716603159832,
    0.262869,-0.525738,-0.809012,1.0,0.024745449131029457,-0.3303859849884664,-0.943521469639406,
    -0.2763880000000001,-0.44721999999999995,-0.850649,1.0,0.024745449131029457,-0.3303859849884664,-0.943521469639406,
    0.0,0.0,-1.0,1.0,0.024745449131029457,-0.3303859849884664,-0.943521469639406,
    -0.587786,0.0,-0.809017,1.0,-0.802609045780158,0.12562900142829417,-0.5831261215483267,
    -0.951058,0.0,-0.309013,1.0,-0.802609045780158,0.12562900142829417,-0.5831261215483267,
    -0.723607,0.44721999999999995,-0.525725,1.0,-0.802609045780158,0.12562900142829417,-0.5831261215483267,
    -0.587786,0.0,-0.809017,1.0,-0.7946555146913549,-0.18759634256157076,-0.5773475774852957,
    -0.688189,-0.525736,-0.499997,1.0,-0.7946555146913549,-0.18759634256157076,-0.5773475774852957,
    -0.951058,0.0,-0.309013,1.0,-0.7946555146913549,-0.18759634256157076,-0.5773475774852957,
    -0.688189,-0.525736,-0.499997,1.0,-0.8896968564009532,-0.3303856481261544,-0.31509494953509276,
    -0.894426,-0.44721600000000006,0.0,1.0,-0.8896968564009532,-0.3303856481261544,-0.31509494953509276,
    -0.951058,0.0,-0.309013,1.0,-0.8896968564009532,-0.3303856481261544,-0.31509494953509276,
    -0.951058,0.0,0.309013,1.0,-0.8026090457801579,0.1256290014282941,0.5831261215483267,
    -0.587786,0.0,0.8090169999999999,1.0,-0.8026090457801579,0.1256290014282941,0.5831261215483267,
    -0.723607,0.44721999999999995,0.525725,1.0,-0.8026090457801579,0.1256290014282941,0.5831261215483267,
    -0.951058,0.0,0.309013,1.0,-0.7946555146913549,-0.1875963425615707,0.5773475774852959,
    -0.688189,-0.525736,0.499997,1.0,-0.7946555146913549,-0.1875963425615707,0.5773475774852959,
    -0.587786,0.0,0.8090169999999999,1.0,-0.7946555146913549,-0.1875963425615707,0.5773475774852959,
    -0.688189,-0.525736,0.499997,1.0,-0.574601616258777,-0.33038874023745146,0.7487831881907544,
    -0.2763880000000001,-0.44721999999999995,0.850649,1.0,-0.574601616258777,-0.33038874023745146,0.7487831881907544,
    -0.587786,0.0,0.8090169999999999,1.0,-0.574601616258777,-0.33038874023745146,0.7487831881907544,
    0.0,0.0,1.0,1.0,0.30656835770507174,0.12562962647955506,0.9435216155471069,
    0.5877859999999999,0.0,0.8090169999999999,1.0,0.30656835770507174,0.12562962647955506,0.9435216155471069,
    0.2763880000000001,0.44721999999999995,0.850649,1.0,0.30656835770507174,0.12562962647955506,0.9435216155471069,
    0.0,0.0,1.0,1.0,0.3035303770456043,-0.187596959658286,0.9341716603159832,
    0.262869,-0.525738,0.8090120000000001,1.0,0.3035303770456043,-0.187596959658286,0.9341716603159832,
    0.5877859999999999,0.0,0.8090169999999999,1.0,0.3035303770456043,-0.187596959658286,0.9341716603159832,
    0.262869,-0.525738,0.8090120000000001,1.0,0.534577066899585,-0.33038712469629006,0.7778635531890891,
    0.7236069999999999,-0.44721999999999995,0.525725,1.0,0.534577066899585,-0.33038712469629006,0.7778635531890891,
    0.5877859999999999,0.0,0.8090169999999999,1.0,0.534577066899585,-0.33038712469629006,0.7778635531890891,
    0.951058,0.0,0.309013,1.0,0.9920772862993613,0.12562904922387666,0.0,
    0.951058,0.0,-0.309013,1.0,0.9920772862993613,0.12562904922387666,0.0,
    0.8944260000000002,0.44721600000000006,0.0,1.0,0.9920772862993613,0.12562904922387666,0.0,
    0.951058,0.0,0.309013,1.0,0.9822457901368378,-0.18759852813510922,0.0,
    0.8506480000000001,-0.525736,0.0,1.0,0.9822457901368378,-0.18759852813510922,0.0,
    0.951058,0.0,-0.309013,1.0,0.9822457901368378,-0.18759852813510922,0.0,
    0.8506480000000001,-0.525736,0.0,1.0,0.90498867587926,-0.33038505727300543,-0.2680321071457978,
    0.7236069999999999,-0.44721999999999995,-0.525725,1.0,0.90498867587926,-0.33038505727300543,-0.2680321071457978,
    0.951058,0.0,-0.309013,1.0,0.90498867587926,-0.33038505727300543,-0.2680321071457978,
    0.4253230000000001,-0.850654,-0.3090109999999999,1.0,0.4713003065101049,-0.6616990252663817,-0.583121274731939,
    0.262869,-0.525738,-0.809012,1.0,0.4713003065101049,-0.6616990252663817,-0.583121274731939,
    0.7236069999999999,-0.44721999999999995,-0.525725,1.0,0.4713003065101049,-0.6616990252663817,-0.583121274731939,
    0.4253230000000001,-0.850654,-0.3090109999999999,1.0,0.18759344736740519,-0.7946587120980674,-0.5773441173091256,
    -0.16245599999999993,-0.850654,-0.49999499999999997,1.0,0.18759344736740519,-0.7946587120980674,-0.5773441173091256,
    0.262869,-0.525738,-0.809012,1.0,0.18759344736740519,-0.7946587120980674,-0.5773441173091256,
    -0.16245599999999993,-0.850654,-0.49999499999999997,1.0,-0.03853161470011383,-0.661699566627769,-0.7487783371554125,
    -0.2763880000000001,-0.44721999999999995,-0.850649,1.0,-0.03853161470011383,-0.661699566627769,-0.7487783371554125,
    0.262869,-0.525738,-0.809012,1.0,-0.03853161470011383,-0.661699566627769,-0.7487783371554125,
    -0.16245599999999993,-0.850654,-0.49999499999999997,1.0,-0.40894628848261005,-0.6616986930009953,-0.628424834659701,
    -0.688189,-0.525736,-0.499997,1.0,-0.40894628848261005,-0.6616986930009953,-0.628424834659701,
    -0.2763880000000001,-0.44721999999999995,-0.850649,1.0,-0.40894628848261005,-0.6616986930009953,-0.628424834659701,
    -0.16245599999999993,-0.850654,-0.49999499999999997,1.0,-0.4911193440656665,-0.7946569896343344,-0.3568221667859312,
    -0.52573,-0.850652,0.0,1.0,-0.4911193440656665,-0.7946569896343344,-0.3568221667859312,
    -0.688189,-0.525736,-0.499997,1.0,-0.4911193440656665,-0.7946569896343344,-0.3568221667859312,
    -0.52573,-0.850652,0.0,1.0,-0.7240423570113705,-0.6616948434464558,-0.19473725737462094,
    -0.894426,-0.44721600000000006,0.0,1.0,-0.7240423570113705,-0.6616948434464558,-0.19473725737462094,
    -0.688189,-0.525736,-0.499997,1.0,-0.7240423570113705,-0.6616948434464558,-0.19473725737462094,
    -0.52573,-0.850652,0.0,1.0,-0.7240423570113704,-0.6616948434464558,0.19473725737462094,
    -0.688189,-0.525736,0.499997,1.0,-0.7240423570113704,-0.6616948434464558,0.19473725737462094,
    -0.894426,-0.44721600000000006,0.0,1.0,-0.7240423570113704,-0.6616948434464558,0.19473725737462094,
    -0.52573,-0.850652,0.0,1.0,-0.4911193440656665,-0.7946569896343344,0.35682216678593115,
    -0.16245599999999993,-0.850654,0.49999499999999997,1.0,-0.4911193440656665,-0.7946569896343344,0.35682216678593115,
    -0.688189,-0.525736,0.499997,1.0,-0.4911193440656665,-0.7946569896343344,0.35682216678593115,
    -0.16245599999999993,-0.850654,0.49999499999999997,1.0,-0.40894628848261,-0.6616986930009953,0.628424834659701,
    -0.2763880000000001,-0.44721999999999995,0.850649,1.0,-0.40894628848261,-0.6616986930009953,0.628424834659701,
    -0.688189,-0.525736,0.499997,1.0,-0.40894628848261,-0.6616986930009953,0.628424834659701,
    0.8506480000000001,-0.525736,0.0,1.0,0.7002238399407358,-0.6616989163236974,-0.26803193487846794,
    0.4253230000000001,-0.850654,-0.3090109999999999,1.0,0.7002238399407358,-0.6616989163236974,-0.26803193487846794,
    0.7236069999999999,-0.44721999999999995,-0.525725,1.0,0.7002238399407358,-0.6616989163236974,-0.26803193487846794,
    0.8506480000000001,-0.525736,0.0,1.0,0.6070603612443728,-0.794655722817027,0.0,
    0.4253230000000001,-0.850654,0.3090109999999999,1.0,0.6070603612443728,-0.794655722817027,0.0,
    0.4253230000000001,-0.850654,-0.3090109999999999,1.0,0.6070603612443728,-0.794655722817027,0.0,
    0.4253230000000001,-0.850654,0.3090109999999999,1.0,0.3313046984393152,-0.9435238188790118,0.0,
    0.0,-1.0,0.0,1.0,0.3313046984393152,-0.9435238188790118,0.0,
    0.4253230000000001,-0.850654,-0.3090109999999999,1.0,0.3313046984393152,-0.9435238188790118,0.0,
    -0.16245599999999993,-0.850654,0.49999499999999997,1.0,-0.03853161470011399,-0.6616995666277691,0.7487783371554124,
    0.262869,-0.525738,0.8090120000000001,1.0,-0.03853161470011399,-0.6616995666277691,0.7487783371554124,
    -0.2763880000000001,-0.44721999999999995,0.850649,1.0,-0.03853161470011399,-0.6616995666277691,0.7487783371554124,
    -0.16245599999999993,-0.850654,0.49999499999999997,1.0,0.18759344736740516,-0.7946587120980674,0.5773441173091255,
    0.4253230000000001,-0.850654,0.3090109999999999,1.0,0.18759344736740516,-0.7946587120980674,0.5773441173091255,
    0.262869,-0.525738,0.8090120000000001,1.0,0.18759344736740516,-0.7946587120980674,0.5773441173091255,
    0.4253230000000001,-0.850654,0.3090109999999999,1.0,0.4713003065101049,-0.6616990252663817,0.583121274731939,
    0.7236069999999999,-0.44721999999999995,0.525725,1.0,0.4713003065101049,-0.6616990252663817,0.583121274731939,
    0.262869,-0.525738,0.8090120000000001,1.0,0.4713003065101049,-0.6616990252663817,0.583121274731939
  ]);
  var colors = [
    .98, .498, .867,
    .871, 0, 0,
    .98, .576, .2,
    .98, .576, .2,
    .871, 0, 0,
    .98, .498, .867
  ];
  var colors_start = 0;
  for (i = 0; i < isoVerts.length; i+=7) {
    isoVerts[i+3] = 1.0;
    isoVerts[i+4] = colors[colors_start]
    isoVerts[i+5] = colors[colors_start + 1];
    isoVerts[i+6] = colors[colors_start + 2];
    if (colors_start == 15) {
      colors_start = 0;
    }
    else {
      colors_start += 3;
    }
  }
  isoLen = isoVerts.length/7;
};
function initWing() {
  wingVerts = new Float32Array([
    -0.2631053078548703,-0.956248163980366,-0.10013976004002301,1.0,-0.5740587862054798,-0.06069767593670441,-0.8165612666029255,
    0.024041219419702164,0.8600028130046273,-0.43701736051146833,1.0,-0.5740587862054798,-0.06069767593670441,-0.8165612666029255,
    -0.005647729923069722,-1.0,-0.2778853326734049,1.0,-0.5740587862054798,-0.06069767593670441,-0.8165612666029255,
    0.024041219419702164,0.8600028130046273,-0.43701736051146833,1.0,0.5927829799326492,-0.07804016232054718,-0.8015722498734291,
    0.24046311314153868,-0.956248163980366,-0.10013976004002301,1.0,0.5927829799326492,-0.07804016232054718,-0.8015722498734291,
    -0.005647729923069722,-1.0,-0.2778853326734049,1.0,0.5927829799326492,-0.07804016232054718,-0.8015722498734291,
    -0.21593300063915732,0.9389122217929522,-0.07745269968326995,1.0,-0.9235279127865258,0.027566866322907283,-0.38253922960305387,
    -0.2631053078548703,-0.956248163980366,-0.10013976004002301,1.0,-0.9235279127865258,0.027566866322907283,-0.38253922960305387,
    -0.36739798852365335,-0.956248163980366,0.1516440943816464,1.0,-0.9235279127865258,0.027566866322907283,-0.38253922960305387,
    0.1541871929952625,0.9104011736282596,-0.177029502721315,1.0,0.9120336853690024,0.15962764465906418,0.37777449862693896,
    0.24046311314153868,-0.956248163980366,0.40342866095638596,1.0,0.9120336853690024,0.15962764465906418,0.37777449862693896,
    0.3447550816572513,-0.956248163980366,0.1516440943816464,1.0,0.9120336853690024,0.15962764465906418,0.37777449862693896,
    -0.030417125857031713,0.9809235557090641,-0.05863334265066944,1.0,-0.36979170911516923,0.25736289459385625,0.8927588881416715,
    -0.2631053078548703,-0.956248163980366,0.40342866095638596,1.0,-0.36979170911516923,0.25736289459385625,0.8927588881416715,
    -0.011321453433201012,-0.956248163980366,0.5077206294720988,1.0,-0.36979170911516923,0.25736289459385625,0.8927588881416715,
    0.24046311314153868,-0.956248163980366,-0.10013976004002301,1.0,0.9235449130970307,0.026928466231109838,-0.38254365920642047,
    0.1541871929952625,0.9104011736282596,-0.177029502721315,1.0,0.9235449130970307,0.026928466231109838,-0.38254365920642047,
    0.3447550816572513,-0.956248163980366,0.1516440943816464,1.0,0.9235449130970307,0.026928466231109838,-0.38254365920642047,
    -0.2631053078548703,-0.956248163980366,-0.10013976004002301,1.0,0.0,-1.0,0.0,
    0.24046311314153868,-0.956248163980366,-0.10013976004002301,1.0,0.0,-1.0,0.0,
    -0.011321453433201012,-0.956248163980366,0.5077206294720988,1.0,0.0,-1.0,0.0,
    -0.08885355818379614,1.0,-0.05124190593526168,1.0,0.18825647156604816,0.7983276002713723,-0.5720424316066545,
    -0.030417125857031713,0.9809235557090641,-0.05863334265066944,1.0,0.18825647156604816,0.7983276002713723,-0.5720424316066545,
    -0.25919202673422637,0.89469606197156,-0.25425894241708313,1.0,0.18825647156604816,0.7983276002713723,-0.5720424316066545,
    -0.2631053078548703,-0.956248163980366,0.40342866095638596,1.0,-0.9172877079222397,0.11924218746686838,0.37995336769514243,
    -0.21593300063915732,0.9389122217929522,-0.07745269968326995,1.0,-0.9172877079222397,0.11924218746686838,0.37995336769514243,
    -0.36739798852365335,-0.956248163980366,0.1516440943816464,1.0,-0.9172877079222397,0.11924218746686838,0.37995336769514243,
    0.24046311314153868,-0.956248163980366,0.40342866095638596,1.0,0.36908914674692544,0.26415126444656545,0.8910652676683719,
    -0.030417125857031713,0.9809235557090641,-0.05863334265066944,1.0,0.36908914674692544,0.26415126444656545,0.8910652676683719,
    -0.011321453433201012,-0.956248163980366,0.5077206294720988,1.0,0.36908914674692544,0.26415126444656545,0.8910652676683719,
    -0.2631053078548703,-0.956248163980366,-0.10013976004002301,1.0,-0.5468125198954639,-0.0683255859616265,-0.8344625110743882,
    -0.25919202673422637,0.89469606197156,-0.25425894241708313,1.0,-0.5468125198954639,-0.0683255859616265,-0.8344625110743882,
    0.024041219419702164,0.8600028130046273,-0.43701736051146833,1.0,-0.5468125198954639,-0.0683255859616265,-0.8344625110743882,
    0.024041219419702164,0.8600028130046273,-0.43701736051146833,1.0,0.8544582062739527,0.005460938422960509,-0.519491435812603,
    0.15304205085841138,0.8700356254573358,-0.22473165182124255,1.0,0.8544582062739527,0.005460938422960509,-0.519491435812603,
    0.24046311314153868,-0.956248163980366,-0.10013976004002301,1.0,0.8544582062739527,0.005460938422960509,-0.519491435812603,
    -0.21593300063915732,0.9389122217929522,-0.07745269968326995,1.0,-0.9723492017643295,0.021418841457557243,0.23254733509306744,
    -0.25919202673422637,0.89469606197156,-0.25425894241708313,1.0,-0.9723492017643295,0.021418841457557243,0.23254733509306744,
    -0.2631053078548703,-0.956248163980366,-0.10013976004002301,1.0,-0.9723492017643295,0.021418841457557243,0.23254733509306744,
    0.1541871929952625,0.9104011736282596,-0.177029502721315,1.0,0.5270890745248551,0.27445956104314073,0.804269268882343,
    0.06915967718101323,0.959902221383464,-0.1381979322635608,1.0,0.5270890745248551,0.27445956104314073,0.804269268882343,
    0.24046311314153868,-0.956248163980366,0.40342866095638596,1.0,0.5270890745248551,0.27445956104314073,0.804269268882343,
    -0.030417125857031713,0.9809235557090641,-0.05863334265066944,1.0,0.18879498077075893,0.20632847451336742,0.9600963575812355,
    -0.08885355818379614,1.0,-0.05124190593526168,1.0,0.18879498077075893,0.20632847451336742,0.9600963575812355,
    -0.2631053078548703,-0.956248163980366,0.40342866095638596,1.0,0.18879498077075893,0.20632847451336742,0.9600963575812355,
    0.24046311314153868,-0.956248163980366,-0.10013976004002301,1.0,0.9971966988367187,0.043584837205765545,-0.06082027453816286,
    0.15304205085841138,0.8700356254573358,-0.22473165182124255,1.0,0.9971966988367187,0.043584837205765545,-0.06082027453816286,
    0.1541871929952625,0.9104011736282596,-0.177029502721315,1.0,0.9971966988367187,0.043584837205765545,-0.06082027453816286,
    -0.2631053078548703,-0.956248163980366,-0.10013976004002301,1.0,0.0,-0.9710160458007607,0.23901430667944248,
    -0.005647729923069722,-1.0,-0.2778853326734049,1.0,0.0,-0.9710160458007607,0.23901430667944248,
    0.24046311314153868,-0.956248163980366,-0.10013976004002301,1.0,0.0,-0.9710160458007607,0.23901430667944248,
    0.24046311314153868,-0.956248163980366,-0.10013976004002301,1.0,0.0,-1.0,0.0,
    0.3447550816572513,-0.956248163980366,0.1516440943816464,1.0,0.0,-1.0,0.0,
    0.24046311314153868,-0.956248163980366,0.40342866095638596,1.0,0.0,-1.0,0.0,
    0.24046311314153868,-0.956248163980366,0.40342866095638596,1.0,-0.0,-1.0,-0.0,
    -0.011321453433201012,-0.956248163980366,0.5077206294720988,1.0,-0.0,-1.0,-0.0,
    0.24046311314153868,-0.956248163980366,-0.10013976004002301,1.0,-0.0,-1.0,-0.0,
    -0.011321453433201012,-0.956248163980366,0.5077206294720988,1.0,0.0,-1.0,-0.0,
    -0.2631053078548703,-0.956248163980366,0.40342866095638596,1.0,0.0,-1.0,-0.0,
    -0.2631053078548703,-0.956248163980366,-0.10013976004002301,1.0,0.0,-1.0,-0.0,
    -0.2631053078548703,-0.956248163980366,0.40342866095638596,1.0,0.0,-1.0,-0.0,
    -0.36739798852365335,-0.956248163980366,0.1516440943816464,1.0,0.0,-1.0,-0.0,
    -0.2631053078548703,-0.956248163980366,-0.10013976004002301,1.0,0.0,-1.0,-0.0,
    0.1541871929952625,0.9104011736282596,-0.177029502721315,1.0,0.14587240661448594,0.7534740151838938,-0.6410913736989133,
    0.15304205085841138,0.8700356254573358,-0.22473165182124255,1.0,0.14587240661448594,0.7534740151838938,-0.6410913736989133,
    0.06915967718101323,0.959902221383464,-0.1381979322635608,1.0,0.14587240661448594,0.7534740151838938,-0.6410913736989133,
    0.15304205085841138,0.8700356254573358,-0.22473165182124255,1.0,0.5001609385996497,0.7957309477964046,-0.34154252183023004,
    0.024041219419702164,0.8600028130046273,-0.43701736051146833,1.0,0.5001609385996497,0.7957309477964046,-0.34154252183023004,
    0.06915967718101323,0.959902221383464,-0.1381979322635608,1.0,0.5001609385996497,0.7957309477964046,-0.34154252183023004,
    0.024041219419702164,0.8600028130046273,-0.43701736051146833,1.0,-0.0806119743290785,0.948914131177151,-0.30506340528991743,
    -0.25919202673422637,0.89469606197156,-0.25425894241708313,1.0,-0.0806119743290785,0.948914131177151,-0.30506340528991743,
    0.06915967718101323,0.959902221383464,-0.1381979322635608,1.0,-0.0806119743290785,0.948914131177151,-0.30506340528991743,
    -0.25919202673422637,0.89469606197156,-0.25425894241708313,1.0,-0.40853930929947524,0.9039860826343459,-0.12611421474408518,
    -0.21593300063915732,0.9389122217929522,-0.07745269968326995,1.0,-0.40853930929947524,0.9039860826343459,-0.12611421474408518,
    -0.08885355818379614,1.0,-0.05124190593526168,1.0,-0.40853930929947524,0.9039860826343459,-0.12611421474408518,
    0.06915967718101323,0.959902221383464,-0.1381979322635608,1.0,-0.06856017615437765,0.9400187988880109,-0.3341618769142019,
    -0.25919202673422637,0.89469606197156,-0.25425894241708313,1.0,-0.06856017615437765,0.9400187988880109,-0.3341618769142019,
    -0.030417125857031713,0.9809235557090641,-0.05863334265066944,1.0,-0.06856017615437765,0.9400187988880109,-0.3341618769142019,
    -0.2631053078548703,-0.956248163980366,0.40342866095638596,1.0,-0.3059480059924833,0.24130163407723712,0.9209610952808368,
    -0.08885355818379614,1.0,-0.05124190593526168,1.0,-0.3059480059924833,0.24130163407723712,0.9209610952808368,
    -0.21593300063915732,0.9389122217929522,-0.07745269968326995,1.0,-0.3059480059924833,0.24130163407723712,0.9209610952808368,
    0.24046311314153868,-0.956248163980366,0.40342866095638596,1.0,0.6355752952747373,0.26208836669566654,0.7261912503460974,
    0.06915967718101323,0.959902221383464,-0.1381979322635608,1.0,0.6355752952747373,0.26208836669566654,0.7261912503460974,
    -0.030417125857031713,0.9809235557090641,-0.05863334265066944,1.0,0.6355752952747373,0.26208836669566654,0.7261912503460974
  ])
  var colors = [
    .251, .204, .204,
    .831, .161, .161,
    .98, .953, .498,
    .98, .953, .498,
    .831, .161, .161, 
    .251, .204, .204
  ];
  var colors_start = 0;
  for (i = 0; i < wingVerts.length; i+=7) {
    wingVerts[i+3] = 1.0;
    wingVerts[i+4] = colors[colors_start]
    wingVerts[i+5] = colors[colors_start + 1];
    wingVerts[i+6] = colors[colors_start + 2];
    if (colors_start == 15) {
      colors_start = 0;
    }
    else {
      colors_start += 3;
    }
  }
  wingLen = wingVerts.length/7;
};
function initDrop() {
  dropVerts = new Float32Array ([
    -0.17788044422730742,-1.0,-0.17788044422730742,1.0,0.10238043975459712,-0.943523099498967,0.31509110788392297,
    0.12214677076126557,-0.8946497955596941,0.04009915436800582,1.0,0.10238043975459712,-0.943523099498967,0.31509110788392297,
    -0.2924784985195701,-0.8946497955596941,0.17482056141570412,1.0,0.10238043975459712,-0.943523099498967,0.31509110788392297,
    0.3325586351847176,-0.6100636437262893,0.19297131933674128,1.0,0.7002237597539341,-0.6616984521511227,0.2680332902772957,
    0.12214677076126557,-0.8946497955596941,0.04009915436800582,1.0,0.7002237597539341,-0.6616984521511227,0.2680332902772957,
    0.42217529731555326,-0.6654497522780256,-0.17788044422730742,1.0,0.7002237597539341,-0.6616984521511227,0.2680332902772957,
    -0.17788044422730742,-1.0,-0.17788044422730742,1.0,-0.26803389962320057,-0.9435227059540282,0.19473759781297617,
    -0.2924784985195701,-0.8946497955596941,0.17482056141570412,1.0,-0.26803389962320057,-0.9435227059540282,0.19473759781297617,
    -0.5487348309227847,-0.8946484839939799,-0.17788044422730742,1.0,-0.26803389962320057,-0.9435227059540282,0.19473759781297617,
    -0.17788044422730742,-1.0,-0.17788044422730742,1.0,-0.2680338996232006,-0.9435227059540281,-0.19473759781297625,
    -0.5487348309227847,-0.8946484839939799,-0.17788044422730742,1.0,-0.2680338996232006,-0.9435227059540281,-0.19473759781297625,
    -0.2924784985195701,-0.8946497955596941,-0.5305814498703189,1.0,-0.2680338996232006,-0.9435227059540281,-0.19473759781297625,
    -0.17788044422730742,-1.0,-0.17788044422730742,1.0,0.10238043975459714,-0.9435230994989667,-0.315091107883923,
    -0.2924784985195701,-0.8946497955596941,-0.5305814498703189,1.0,0.10238043975459714,-0.9435230994989667,-0.315091107883923,
    0.12214677076126557,-0.8946497955596941,-0.39586004282262055,1.0,0.10238043975459714,-0.9435230994989667,-0.315091107883923,
    0.3325586351847176,-0.6100636437262893,0.19297131933674128,1.0,0.9049883322612448,-0.3303847326666196,0.2680336674595507,
    0.42217529731555326,-0.6654497522780256,-0.17788044422730742,1.0,0.9049883322612448,-0.3303847326666196,0.2680336674595507,
    0.4930050921538862,-0.2945901193196908,0.040100465933720075,1.0,0.9049883322612448,-0.3303847326666196,0.2680336674595507,
    -0.37284731079844835,-0.6100636437262893,0.42217529731555326,1.0,0.024745340367949432,-0.3303870715531093,0.943521092016832,
    0.00755002803471716,-0.66545106384374,0.39280409470816013,1.0,0.024745340367949432,-0.3303870715531093,0.943521092016832,
    -0.17788044422730742,-0.2945901193196908,0.5275294364530021,1.0,0.024745340367949432,-0.3303870715531093,0.943521092016832,
    -0.8088170005147894,-0.6100610205948606,-0.17788044422730742,1.0,-0.8896966985708987,-0.33038601308233034,0.315095012514647,
    -0.6633355083464763,-0.6654497522780256,0.17482187298141838,1.0,-0.8896966985708987,-0.33038601308233034,0.315095012514647,
    -0.848765980608501,-0.2945901193196908,0.040100465933720075,1.0,-0.8896966985708987,-0.33038601308233034,0.315095012514647,
    -0.37284731079844835,-0.6100636437262893,-0.7779361857701678,1.0,-0.5746021145787622,-0.33038820471517577,-0.7487830420800796,
    -0.6633355083464763,-0.6654497522780256,-0.5305827614360332,1.0,-0.5746021145787622,-0.33038820471517577,-0.7487830420800796,
    -0.5925096482052863,-0.2945901193196908,-0.7485689178599182,1.0,-0.5746021145787622,-0.33038820471517577,-0.7487830420800796,
    0.3325586351847176,-0.6100636437262893,-0.5487322077913561,1.0,0.5345766380458904,-0.3303862267365608,-0.7778642293089011,
    0.00755002803471716,-0.66545106384374,-0.7485649831627751,1.0,0.5345766380458904,-0.3303862267365608,-0.7778642293089011,
    0.23674875975067144,-0.2945901193196908,-0.7485689178599182,1.0,0.5345766380458904,-0.3303862267365608,-0.7778642293089011,
    0.3325586351847176,-0.6100636437262893,0.19297131933674128,1.0,0.802608212047047,-0.12562849474047424,0.5831273782492855,
    0.4930050921538862,-0.2945901193196908,0.040100465933720075,1.0,0.802608212047047,-0.12562849474047424,0.5831273782492855,
    0.23674875975067144,-0.2945901193196908,0.39280802940530357,1.0,0.802608212047047,-0.12562849474047424,0.5831273782492855,
    -0.37284731079844835,-0.6100636437262893,0.42217529731555326,1.0,-0.30656912676738246,-0.1256303492946036,0.9435212694206742,
    -0.17788044422730742,-0.2945901193196908,0.5275294364530021,1.0,-0.30656912676738246,-0.1256303492946036,0.9435212694206742,
    -0.5925096482052863,-0.2945901193196908,0.39280802940530357,1.0,-0.30656912676738246,-0.1256303492946036,0.9435212694206742,
    -0.8088170005147894,-0.6100610205948606,-0.17788044422730742,1.0,-0.9920772205684123,-0.1256295682920774,-0.0,
    -0.848765980608501,-0.2945901193196908,0.040100465933720075,1.0,-0.9920772205684123,-0.1256295682920774,-0.0,
    -0.848765980608501,-0.2945901193196908,-0.3958613543883348,1.0,-0.9920772205684123,-0.1256295682920774,-0.0,
    -0.37284731079844835,-0.6100636437262893,-0.7779361857701678,1.0,-0.30656912676738224,-0.1256303492946038,-0.9435212694206743,
    -0.5925096482052863,-0.2945901193196908,-0.7485689178599182,1.0,-0.30656912676738224,-0.1256303492946038,-0.9435212694206743,
    -0.17788044422730742,-0.2945901193196908,-0.8832903249076166,1.0,-0.30656912676738224,-0.1256303492946038,-0.9435212694206743,
    0.3325586351847176,-0.6100636437262893,-0.5487322077913561,1.0,0.8026082120470468,-0.12562849474047394,-0.5831273782492855,
    0.23674875975067144,-0.2945901193196908,-0.7485689178599182,1.0,0.8026082120470468,-0.12562849474047394,-0.5831273782492855,
    0.4930050921538862,-0.2945901193196908,-0.3958613543883348,1.0,0.8026082120470468,-0.12562849474047394,-0.5831273782492855,
    0.017086422343833618,0.02088340508690778,0.42217529731555326,1.0,0.5492731046858592,0.39444081964916117,0.7366922670038386,
    0.30757461989186163,0.07834703373019125,0.17482187298141838,1.0,0.5492731046858592,0.39444081964916117,0.7366922670038386,
    -0.06328238993504465,0.5947812800225591,0.17482056141570412,1.0,0.5492731046858592,0.39444081964916117,0.7366922670038386,
    -0.6883195236393325,0.02088340508690778,0.19297131933674128,1.0,-0.5309037409763729,0.39444035735171784,0.7500386805422381,
    -0.363310916489332,0.07834703373019125,0.39280409470816013,1.0,-0.5309037409763729,0.39444035735171784,0.7500386805422381,
    -0.4779076592158804,0.5947812800225591,0.04009915436800582,1.0,-0.5309037409763729,0.39444035735171784,0.7500386805422381,
    -0.6883195236393325,0.02088340508690778,-0.5487322077913561,1.0,-0.8773891969293992,0.3944403433213711,-0.27313918186906655,
    -0.7779361857701678,0.078345722164477,-0.17788044422730742,1.0,-0.8773891969293992,0.3944403433213711,-0.27313918186906655,
    -0.4779076592158804,0.5947812800225591,-0.39586004282262055,1.0,-0.8773891969293992,0.3944403433213711,-0.27313918186906655,
    0.017086422343833618,0.02088340508690778,-0.7779361857701678,1.0,-0.011361082122744578,0.3944413331510385,-0.9188508913393031,
    -0.363310916489332,0.07834703373019125,-0.7485649831627751,1.0,-0.011361082122744578,0.3944413331510385,-0.9188508913393031,
    -0.06328238993504465,0.5947812800225591,-0.5305814498703189,1.0,-0.011361082122744578,0.3944413331510385,-0.9188508913393031,
    0.4530561120601748,0.020879470389764565,-0.17788044422730742,1.0,0.8703711283677815,0.39443953585211566,-0.2947398029797847,
    0.30757461989186163,0.07834703373019125,-0.5305827614360332,1.0,0.8703711283677815,0.39443953585211566,-0.2947398029797847,
    0.19297394246817,0.5947773453254162,-0.17788044422730742,1.0,0.8703711283677815,0.39443953585211566,-0.2947398029797847,
    0.19297394246817,0.5947773453254162,-0.17788044422730742,1.0,0.6501966237447044,0.5950513066056284,-0.47239633040268375,
    -0.06328238993504465,0.5947812800225591,-0.5305814498703189,1.0,0.6501966237447044,0.5950513066056284,-0.47239633040268375,
    -0.17788044422730742,1.0,-0.17788044422730742,1.0,0.6501966237447044,0.5950513066056284,-0.47239633040268375,
    0.19297394246817,0.5947773453254162,-0.17788044422730742,1.0,0.6995308119856929,0.5023419218790917,-0.5082413172947058,
    0.30757461989186163,0.07834703373019125,-0.5305827614360332,1.0,0.6995308119856929,0.5023419218790917,-0.5082413172947058,
    -0.06328238993504465,0.5947812800225591,-0.5305814498703189,1.0,0.6995308119856929,0.5023419218790917,-0.5082413172947058,
    0.30757461989186163,0.07834703373019125,-0.5305827614360332,1.0,0.5492731046858588,0.394440819649161,-0.736692267003839,
    0.017086422343833618,0.02088340508690778,-0.7779361857701678,1.0,0.5492731046858588,0.394440819649161,-0.736692267003839,
    -0.06328238993504465,0.5947812800225591,-0.5305814498703189,1.0,0.5492731046858588,0.394440819649161,-0.736692267003839,
    -0.06328238993504465,0.5947812800225591,-0.5305814498703189,1.0,-0.248355433573773,0.5950522406637868,-0.7643509727182859,
    -0.4779076592158804,0.5947812800225591,-0.39586004282262055,1.0,-0.248355433573773,0.5950522406637868,-0.7643509727182859,
    -0.17788044422730742,1.0,-0.17788044422730742,1.0,-0.248355433573773,0.5950522406637868,-0.7643509727182859,
    -0.06328238993504465,0.5947812800225591,-0.5305814498703189,1.0,-0.2672002482369609,0.502341150619045,-0.8223487068980168,
    -0.363310916489332,0.07834703373019125,-0.7485649831627751,1.0,-0.2672002482369609,0.502341150619045,-0.8223487068980168,
    -0.4779076592158804,0.5947812800225591,-0.39586004282262055,1.0,-0.2672002482369609,0.502341150619045,-0.8223487068980168,
    -0.363310916489332,0.07834703373019125,-0.7485649831627751,1.0,-0.530903740976373,0.39444035735171795,-0.7500386805422379,
    -0.6883195236393325,0.02088340508690778,-0.5487322077913561,1.0,-0.530903740976373,0.39444035735171795,-0.7500386805422379,
    -0.4779076592158804,0.5947812800225591,-0.39586004282262055,1.0,-0.530903740976373,0.39444035735171795,-0.7500386805422379,
    -0.4779076592158804,0.5947812800225591,-0.39586004282262055,1.0,-0.8036850497538358,0.5950549057038136,0.0,
    -0.4779076592158804,0.5947812800225591,0.04009915436800582,1.0,-0.8036850497538358,0.5950549057038136,0.0,
    -0.17788044422730742,1.0,-0.17788044422730742,1.0,-0.8036850497538358,0.5950549057038136,0.0,
    -0.4779076592158804,0.5947812800225591,-0.39586004282262055,1.0,-0.8646706175599432,0.5023392510331103,0.0,
    -0.7779361857701678,0.078345722164477,-0.17788044422730742,1.0,-0.8646706175599432,0.5023392510331103,0.0,
    -0.4779076592158804,0.5947812800225591,0.04009915436800582,1.0,-0.8646706175599432,0.5023392510331103,0.0,
    -0.7779361857701678,0.078345722164477,-0.17788044422730742,1.0,-0.8773891969293992,0.39444034332137107,0.27313918186906655,
    -0.6883195236393325,0.02088340508690778,0.19297131933674128,1.0,-0.8773891969293992,0.39444034332137107,0.27313918186906655,
    -0.4779076592158804,0.5947812800225591,0.04009915436800582,1.0,-0.8773891969293992,0.39444034332137107,0.27313918186906655,
    -0.4779076592158804,0.5947812800225591,0.04009915436800582,1.0,-0.248355433573773,0.5950522406637869,0.7643509727182859,
    -0.06328238993504465,0.5947812800225591,0.17482056141570412,1.0,-0.248355433573773,0.5950522406637869,0.7643509727182859,
    -0.17788044422730742,1.0,-0.17788044422730742,1.0,-0.248355433573773,0.5950522406637869,0.7643509727182859,
    -0.4779076592158804,0.5947812800225591,0.04009915436800582,1.0,-0.2672002482369609,0.5023411506190448,0.8223487068980169,
    -0.363310916489332,0.07834703373019125,0.39280409470816013,1.0,-0.2672002482369609,0.5023411506190448,0.8223487068980169,
    -0.06328238993504465,0.5947812800225591,0.17482056141570412,1.0,-0.2672002482369609,0.5023411506190448,0.8223487068980169,
    -0.363310916489332,0.07834703373019125,0.39280409470816013,1.0,-0.011361082122745614,0.39444133315103874,0.918850891339303,
    0.017086422343833618,0.02088340508690778,0.42217529731555326,1.0,-0.011361082122745614,0.39444133315103874,0.918850891339303,
    -0.06328238993504465,0.5947812800225591,0.17482056141570412,1.0,-0.011361082122745614,0.39444133315103874,0.918850891339303,
    -0.06328238993504465,0.5947812800225591,0.17482056141570412,1.0,0.6501966237447045,0.5950513066056284,0.47239633040268364,
    0.19297394246817,0.5947773453254162,-0.17788044422730742,1.0,0.6501966237447045,0.5950513066056284,0.47239633040268364,
    -0.17788044422730742,1.0,-0.17788044422730742,1.0,0.6501966237447045,0.5950513066056284,0.47239633040268364,
    -0.06328238993504465,0.5947812800225591,0.17482056141570412,1.0,0.699530811985693,0.5023419218790917,0.5082413172947057,
    0.30757461989186163,0.07834703373019125,0.17482187298141838,1.0,0.699530811985693,0.5023419218790917,0.5082413172947057,
    0.19297394246817,0.5947773453254162,-0.17788044422730742,1.0,0.699530811985693,0.5023419218790917,0.5082413172947057,
    0.30757461989186163,0.07834703373019125,0.17482187298141838,1.0,0.8703711283677815,0.39443953585211566,0.2947398029797847,
    0.4530561120601748,0.020879470389764565,-0.17788044422730742,1.0,0.8703711283677815,0.39443953585211566,0.2947398029797847,
    0.19297394246817,0.5947773453254162,-0.17788044422730742,1.0,0.8703711283677815,0.39443953585211566,0.2947398029797847,
    0.4930050921538862,-0.2945901193196908,-0.3958613543883348,1.0,0.8905417330034887,0.32949052613485585,-0.31364217663847255,
    0.30757461989186163,0.07834703373019125,-0.5305827614360332,1.0,0.8905417330034887,0.32949052613485585,-0.31364217663847255,
    0.4530561120601748,0.020879470389764565,-0.17788044422730742,1.0,0.8905417330034887,0.32949052613485585,-0.31364217663847255,
    0.4930050921538862,-0.2945901193196908,-0.3958613543883348,1.0,0.7948100251528799,0.18658786812853292,-0.5774616795803229,
    0.23674875975067144,-0.2945901193196908,-0.7485689178599182,1.0,0.7948100251528799,0.18658786812853292,-0.5774616795803229,
    0.30757461989186163,0.07834703373019125,-0.5305827614360332,1.0,0.7948100251528799,0.18658786812853292,-0.5774616795803229,
    0.23674875975067144,-0.2945901193196908,-0.7485689178599182,1.0,0.5734826116275947,0.32949215016190425,-0.7500350772747089,
    0.017086422343833618,0.02088340508690778,-0.7779361857701678,1.0,0.5734826116275947,0.32949215016190425,-0.7500350772747089,
    0.30757461989186163,0.07834703373019125,-0.5305827614360332,1.0,0.5734826116275947,0.32949215016190425,-0.7500350772747089,
    -0.17788044422730742,-0.2945901193196908,-0.8832903249076166,1.0,-0.023104743695397868,0.3294916046870969,-0.9438757615594818,
    -0.363310916489332,0.07834703373019125,-0.7485649831627751,1.0,-0.023104743695397868,0.3294916046870969,-0.9438757615594818,
    0.017086422343833618,0.02088340508690778,-0.7779361857701678,1.0,-0.023104743695397868,0.3294916046870969,-0.9438757615594818,
    -0.17788044422730742,-0.2945901193196908,-0.8832903249076166,1.0,-0.3035904495383546,0.18658967556771006,-0.9343538579792114,
    -0.5925096482052863,-0.2945901193196908,-0.7485689178599182,1.0,-0.3035904495383546,0.18658967556771006,-0.9343538579792114,
    -0.363310916489332,0.07834703373019125,-0.7485649831627751,1.0,-0.3035904495383546,0.18658967556771006,-0.9343538579792114,
    -0.5925096482052863,-0.2945901193196908,-0.7485689178599182,1.0,-0.5361123737552567,0.3294907281611977,-0.7771868390305563,
    -0.6883195236393325,0.02088340508690778,-0.5487322077913561,1.0,-0.5361123737552567,0.3294907281611977,-0.7771868390305563,
    -0.363310916489332,0.07834703373019125,-0.7485649831627751,1.0,-0.5361123737552567,0.3294907281611977,-0.7771868390305563,
    -0.848765980608501,-0.2945901193196908,-0.3958613543883348,1.0,-0.9048186667864521,0.329489248376126,-0.26970356957096975,
    -0.7779361857701678,0.078345722164477,-0.17788044422730742,1.0,-0.9048186667864521,0.329489248376126,-0.26970356957096975,
    -0.6883195236393325,0.02088340508690778,-0.5487322077913561,1.0,-0.9048186667864521,0.329489248376126,-0.26970356957096975,
    -0.848765980608501,-0.2945901193196908,-0.3958613543883348,1.0,-0.9824379827477361,0.1865894157088202,0.0,
    -0.848765980608501,-0.2945901193196908,0.040100465933720075,1.0,-0.9824379827477361,0.1865894157088202,0.0,
    -0.7779361857701678,0.078345722164477,-0.17788044422730742,1.0,-0.9824379827477361,0.1865894157088202,0.0,
    -0.848765980608501,-0.2945901193196908,0.040100465933720075,1.0,-0.9048186667864521,0.3294892483761261,0.2697035695709698,
    -0.6883195236393325,0.02088340508690778,0.19297131933674128,1.0,-0.9048186667864521,0.3294892483761261,0.2697035695709698,
    -0.7779361857701678,0.078345722164477,-0.17788044422730742,1.0,-0.9048186667864521,0.3294892483761261,0.2697035695709698,
    -0.5925096482052863,-0.2945901193196908,0.39280802940530357,1.0,-0.5361123737552564,0.32949072816119823,0.7771868390305561,
    -0.363310916489332,0.07834703373019125,0.39280409470816013,1.0,-0.5361123737552564,0.32949072816119823,0.7771868390305561,
    -0.6883195236393325,0.02088340508690778,0.19297131933674128,1.0,-0.5361123737552564,0.32949072816119823,0.7771868390305561,
    -0.5925096482052863,-0.2945901193196908,0.39280802940530357,1.0,-0.30359044953835473,0.186589675567711,0.9343538579792111,
    -0.17788044422730742,-0.2945901193196908,0.5275294364530021,1.0,-0.30359044953835473,0.186589675567711,0.9343538579792111,
    -0.363310916489332,0.07834703373019125,0.39280409470816013,1.0,-0.30359044953835473,0.186589675567711,0.9343538579792111,
    -0.17788044422730742,-0.2945901193196908,0.5275294364530021,1.0,-0.02310474369539886,0.32949160468709743,0.9438757615594816,
    0.017086422343833618,0.02088340508690778,0.42217529731555326,1.0,-0.02310474369539886,0.32949160468709743,0.9438757615594816,
    -0.363310916489332,0.07834703373019125,0.39280409470816013,1.0,-0.02310474369539886,0.32949160468709743,0.9438757615594816,
    0.23674875975067144,-0.2945901193196908,0.39280802940530357,1.0,0.5734826116275952,0.3294921501619043,0.7500350772747083,
    0.30757461989186163,0.07834703373019125,0.17482187298141838,1.0,0.5734826116275952,0.3294921501619043,0.7500350772747083,
    0.017086422343833618,0.02088340508690778,0.42217529731555326,1.0,0.5734826116275952,0.3294921501619043,0.7500350772747083,
    0.23674875975067144,-0.2945901193196908,0.39280802940530357,1.0,0.79481002515288,0.18658786812853312,0.5774616795803227,
    0.4930050921538862,-0.2945901193196908,0.040100465933720075,1.0,0.79481002515288,0.18658786812853312,0.5774616795803227,
    0.30757461989186163,0.07834703373019125,0.17482187298141838,1.0,0.79481002515288,0.18658786812853312,0.5774616795803227,
    0.4930050921538862,-0.2945901193196908,0.040100465933720075,1.0,0.8905417330034887,0.329490526134856,0.3136421766384725,
    0.4530561120601748,0.020879470389764565,-0.17788044422730742,1.0,0.8905417330034887,0.329490526134856,0.3136421766384725,
    0.30757461989186163,0.07834703373019125,0.17482187298141838,1.0,0.8905417330034887,0.329490526134856,0.3136421766384725,
    0.23674875975067144,-0.2945901193196908,-0.7485689178599182,1.0,0.30656912676738224,0.12563034929460362,-0.9435212694206744,
    -0.17788044422730742,-0.2945901193196908,-0.8832903249076166,1.0,0.30656912676738224,0.12563034929460362,-0.9435212694206744,
    0.017086422343833618,0.02088340508690778,-0.7779361857701678,1.0,0.30656912676738224,0.12563034929460362,-0.9435212694206744,
    0.23674875975067144,-0.2945901193196908,-0.7485689178599182,1.0,0.3035311283480776,-0.18759760595462807,-0.9341712864158451,
    0.00755002803471716,-0.66545106384374,-0.7485649831627751,1.0,0.3035311283480776,-0.18759760595462807,-0.9341712864158451,
    -0.17788044422730742,-0.2945901193196908,-0.8832903249076166,1.0,0.3035311283480776,-0.18759760595462807,-0.9341712864158451,
    0.00755002803471716,-0.66545106384374,-0.7485649831627751,1.0,0.024745340367948437,-0.3303870715531088,-0.9435210920168321,
    -0.37284731079844835,-0.6100636437262893,-0.7779361857701678,1.0,0.024745340367948437,-0.3303870715531088,-0.9435210920168321,
    -0.17788044422730742,-0.2945901193196908,-0.8832903249076166,1.0,0.024745340367948437,-0.3303870715531088,-0.9435210920168321,
    -0.5925096482052863,-0.2945901193196908,-0.7485689178599182,1.0,-0.802608212047047,0.1256284947404738,-0.5831273782492855,
    -0.848765980608501,-0.2945901193196908,-0.3958613543883348,1.0,-0.802608212047047,0.1256284947404738,-0.5831273782492855,
    -0.6883195236393325,0.02088340508690778,-0.5487322077913561,1.0,-0.802608212047047,0.1256284947404738,-0.5831273782492855,
    -0.5925096482052863,-0.2945901193196908,-0.7485689178599182,1.0,-0.7946546243838641,-0.18759642955682326,-0.5773487746266305,
    -0.6633355083464763,-0.6654497522780256,-0.5305827614360332,1.0,-0.7946546243838641,-0.18759642955682326,-0.5773487746266305,
    -0.848765980608501,-0.2945901193196908,-0.3958613543883348,1.0,-0.7946546243838641,-0.18759642955682326,-0.5773487746266305,
    -0.6633355083464763,-0.6654497522780256,-0.5305827614360332,1.0,-0.8896966985708987,-0.33038601308233023,-0.315095012514647,
    -0.8088170005147894,-0.6100610205948606,-0.17788044422730742,1.0,-0.8896966985708987,-0.33038601308233023,-0.315095012514647,
    -0.848765980608501,-0.2945901193196908,-0.3958613543883348,1.0,-0.8896966985708987,-0.33038601308233023,-0.315095012514647,
    -0.848765980608501,-0.2945901193196908,0.040100465933720075,1.0,-0.802608212047047,0.1256284947404741,0.5831273782492853,
    -0.5925096482052863,-0.2945901193196908,0.39280802940530357,1.0,-0.802608212047047,0.1256284947404741,0.5831273782492853,
    -0.6883195236393325,0.02088340508690778,0.19297131933674128,1.0,-0.802608212047047,0.1256284947404741,0.5831273782492853,
    -0.848765980608501,-0.2945901193196908,0.040100465933720075,1.0,-0.7946546243838641,-0.1875964295568235,0.5773487746266304,
    -0.6633355083464763,-0.6654497522780256,0.17482187298141838,1.0,-0.7946546243838641,-0.1875964295568235,0.5773487746266304,
    -0.5925096482052863,-0.2945901193196908,0.39280802940530357,1.0,-0.7946546243838641,-0.1875964295568235,0.5773487746266304,
    -0.6633355083464763,-0.6654497522780256,0.17482187298141838,1.0,-0.5746021145787626,-0.33038820471517577,0.7487830420800791,
    -0.37284731079844835,-0.6100636437262893,0.42217529731555326,1.0,-0.5746021145787626,-0.33038820471517577,0.7487830420800791,
    -0.5925096482052863,-0.2945901193196908,0.39280802940530357,1.0,-0.5746021145787626,-0.33038820471517577,0.7487830420800791,
    -0.17788044422730742,-0.2945901193196908,0.5275294364530021,1.0,0.3065691267673824,0.12563034929460343,0.9435212694206742,
    0.23674875975067144,-0.2945901193196908,0.39280802940530357,1.0,0.3065691267673824,0.12563034929460343,0.9435212694206742,
    0.017086422343833618,0.02088340508690778,0.42217529731555326,1.0,0.3065691267673824,0.12563034929460343,0.9435212694206742,
    -0.17788044422730742,-0.2945901193196908,0.5275294364530021,1.0,0.30353112834807777,-0.18759760595462902,0.9341712864158448,
    0.00755002803471716,-0.66545106384374,0.39280409470816013,1.0,0.30353112834807777,-0.18759760595462902,0.9341712864158448,
    0.23674875975067144,-0.2945901193196908,0.39280802940530357,1.0,0.30353112834807777,-0.18759760595462902,0.9341712864158448,
    0.00755002803471716,-0.66545106384374,0.39280409470816013,1.0,0.5345766380458902,-0.3303862267365615,0.7778642293089011,
    0.3325586351847176,-0.6100636437262893,0.19297131933674128,1.0,0.5345766380458902,-0.3303862267365615,0.7778642293089011,
    0.23674875975067144,-0.2945901193196908,0.39280802940530357,1.0,0.5345766380458902,-0.3303862267365615,0.7778642293089011,
    0.4930050921538862,-0.2945901193196908,0.040100465933720075,1.0,0.9920771554711648,0.1256300823538793,0.0,
    0.4930050921538862,-0.2945901193196908,-0.3958613543883348,1.0,0.9920771554711648,0.1256300823538793,0.0,
    0.4530561120601748,0.020879470389764565,-0.17788044422730742,1.0,0.9920771554711648,0.1256300823538793,0.0,
    0.4930050921538862,-0.2945901193196908,0.040100465933720075,1.0,0.9822460154610834,-0.18759734835765976,0.0,
    0.42217529731555326,-0.6654497522780256,-0.17788044422730742,1.0,0.9822460154610834,-0.18759734835765976,0.0,
    0.4930050921538862,-0.2945901193196908,-0.3958613543883348,1.0,0.9822460154610834,-0.18759734835765976,0.0,
    0.42217529731555326,-0.6654497522780256,-0.17788044422730742,1.0,0.904988332261245,-0.3303847326666196,-0.2680336674595508,
    0.3325586351847176,-0.6100636437262893,-0.5487322077913561,1.0,0.904988332261245,-0.3303847326666196,-0.2680336674595508,
    0.4930050921538862,-0.2945901193196908,-0.3958613543883348,1.0,0.904988332261245,-0.3303847326666196,-0.2680336674595508,
    0.12214677076126557,-0.8946497955596941,-0.39586004282262055,1.0,0.4713002295184785,-0.6616985928850512,-0.5831218276053235,
    0.00755002803471716,-0.66545106384374,-0.7485649831627751,1.0,0.4713002295184785,-0.6616985928850512,-0.5831218276053235,
    0.3325586351847176,-0.6100636437262893,-0.5487322077913561,1.0,0.4713002295184785,-0.6616985928850512,-0.5831218276053235,
    0.12214677076126557,-0.8946497955596941,-0.39586004282262055,1.0,0.1875926744320528,-0.7946586178190255,-0.5773444982204177,
    -0.2924784985195701,-0.8946497955596941,-0.5305814498703189,1.0,0.1875926744320528,-0.7946586178190255,-0.5773444982204177,
    0.00755002803471716,-0.66545106384374,-0.7485649831627751,1.0,0.1875926744320528,-0.7946586178190255,-0.5773444982204177,
    -0.2924784985195701,-0.8946497955596941,-0.5305814498703189,1.0,-0.03853161472116944,-0.6616997149027118,-0.7487782061229142,
    -0.37284731079844835,-0.6100636437262893,-0.7779361857701678,1.0,-0.03853161472116944,-0.6616997149027118,-0.7487782061229142,
    0.00755002803471716,-0.66545106384374,-0.7485649831627751,1.0,-0.03853161472116944,-0.6616997149027118,-0.7487782061229142,
    -0.2924784985195701,-0.8946497955596941,-0.5305814498703189,1.0,-0.40894626360837183,-0.6616988834314145,-0.6284246503331736,
    -0.6633355083464763,-0.6654497522780256,-0.5305827614360332,1.0,-0.40894626360837183,-0.6616988834314145,-0.6284246503331736,
    -0.37284731079844835,-0.6100636437262893,-0.7779361857701678,1.0,-0.40894626360837183,-0.6616988834314145,-0.6284246503331736,
    -0.2924784985195701,-0.8946497955596941,-0.5305814498703189,1.0,-0.4911192369871617,-0.7946572657004586,-0.35682169935504027,
    -0.5487348309227847,-0.8946484839939799,-0.17788044422730742,1.0,-0.4911192369871617,-0.7946572657004586,-0.35682169935504027,
    -0.6633355083464763,-0.6654497522780256,-0.5305827614360332,1.0,-0.4911192369871617,-0.7946572657004586,-0.35682169935504027,
    -0.5487348309227847,-0.8946484839939799,-0.17788044422730742,1.0,-0.7240416174242009,-0.6616957489462382,-0.19473693040670031,
    -0.8088170005147894,-0.6100610205948606,-0.17788044422730742,1.0,-0.7240416174242009,-0.6616957489462382,-0.19473693040670031,
    -0.6633355083464763,-0.6654497522780256,-0.5305827614360332,1.0,-0.7240416174242009,-0.6616957489462382,-0.19473693040670031,
    -0.5487348309227847,-0.8946484839939799,-0.17788044422730742,1.0,-0.7240416174242009,-0.6616957489462381,0.1947369304067003,
    -0.6633355083464763,-0.6654497522780256,0.17482187298141838,1.0,-0.7240416174242009,-0.6616957489462381,0.1947369304067003,
    -0.8088170005147894,-0.6100610205948606,-0.17788044422730742,1.0,-0.7240416174242009,-0.6616957489462381,0.1947369304067003,
    -0.5487348309227847,-0.8946484839939799,-0.17788044422730742,1.0,-0.49111923698716187,-0.7946572657004586,0.35682169935504027,
    -0.2924784985195701,-0.8946497955596941,0.17482056141570412,1.0,-0.49111923698716187,-0.7946572657004586,0.35682169935504027,
    -0.6633355083464763,-0.6654497522780256,0.17482187298141838,1.0,-0.49111923698716187,-0.7946572657004586,0.35682169935504027,
    -0.2924784985195701,-0.8946497955596941,0.17482056141570412,1.0,-0.4089462636083721,-0.6616988834314147,0.6284246503331733,
    -0.37284731079844835,-0.6100636437262893,0.42217529731555326,1.0,-0.4089462636083721,-0.6616988834314147,0.6284246503331733,
    -0.6633355083464763,-0.6654497522780256,0.17482187298141838,1.0,-0.4089462636083721,-0.6616988834314147,0.6284246503331733,
    0.42217529731555326,-0.6654497522780256,-0.17788044422730742,1.0,0.7002237597539341,-0.6616984521511227,-0.2680332902772957,
    0.12214677076126557,-0.8946497955596941,-0.39586004282262055,1.0,0.7002237597539341,-0.6616984521511227,-0.2680332902772957,
    0.3325586351847176,-0.6100636437262893,-0.5487322077913561,1.0,0.7002237597539341,-0.6616984521511227,-0.2680332902772957,
    0.42217529731555326,-0.6654497522780256,-0.17788044422730742,1.0,0.6070597305628295,-0.7946562046124004,0.0,
    0.12214677076126557,-0.8946497955596941,0.04009915436800582,1.0,0.6070597305628295,-0.7946562046124004,0.0,
    0.12214677076126557,-0.8946497955596941,-0.39586004282262055,1.0,0.6070597305628295,-0.7946562046124004,0.0,
    0.12214677076126557,-0.8946497955596941,0.04009915436800582,1.0,0.33130470208250373,-0.943523817599759,0.0,
    -0.17788044422730742,-1.0,-0.17788044422730742,1.0,0.33130470208250373,-0.943523817599759,0.0,
    0.12214677076126557,-0.8946497955596941,-0.39586004282262055,1.0,0.33130470208250373,-0.943523817599759,0.0,
    -0.2924784985195701,-0.8946497955596941,0.17482056141570412,1.0,-0.03853161472116862,-0.661699714902712,0.7487782061229141,
    0.00755002803471716,-0.66545106384374,0.39280409470816013,1.0,-0.03853161472116862,-0.661699714902712,0.7487782061229141,
    -0.37284731079844835,-0.6100636437262893,0.42217529731555326,1.0,-0.03853161472116862,-0.661699714902712,0.7487782061229141,
    -0.2924784985195701,-0.8946497955596941,0.17482056141570412,1.0,0.18759267443205288,-0.7946586178190252,0.577344498220418,
    0.12214677076126557,-0.8946497955596941,0.04009915436800582,1.0,0.18759267443205288,-0.7946586178190252,0.577344498220418,
    0.00755002803471716,-0.66545106384374,0.39280409470816013,1.0,0.18759267443205288,-0.7946586178190252,0.577344498220418,
    0.12214677076126557,-0.8946497955596941,0.04009915436800582,1.0,0.47130022951847844,-0.6616985928850511,0.5831218276053238,
    0.3325586351847176,-0.6100636437262893,0.19297131933674128,1.0,0.47130022951847844,-0.6616985928850511,0.5831218276053238,
    0.00755002803471716,-0.66545106384374,0.39280409470816013,1.0,0.47130022951847844,-0.6616985928850511,0.5831218276053238
  ])
  var colors = [
    1, 1, 1,
    .141, .953, .98,
    0, 0, 1,
    0, 0, 1,
    .141, .953, .98,
    1, 1, 1
  ];
  var colors_start = 0;
  for (i = 0; i < dropVerts.length; i+=7) {
    dropVerts[i+3] = 1.0;
    dropVerts[i+4] = colors[colors_start]
    dropVerts[i+5] = colors[colors_start + 1];
    dropVerts[i+6] = colors[colors_start + 2];
    if (colors_start == 15) {
      colors_start = 0;
    }
    else {
      colors_start += 3;
    }
  }
  dropLen = dropVerts.length/7;
}
function initCone() {
  coneVerts = new Float32Array ([
    0.0,-1.0,-1.0,1.0,0.34740762569578043,0.419358543875863,-0.838717087751726,
    0.0,1.0,0.0,1.0,0.34740762569578043,0.419358543875863,-0.838717087751726,
    0.7071070000000002,-1.0,-0.707107,1.0,0.34740762569578043,0.419358543875863,-0.838717087751726,
    0.7071070000000002,-1.0,-0.707107,1.0,0.838717087751726,0.419358543875863,-0.3474076256957803,
    0.0,1.0,0.0,1.0,0.838717087751726,0.419358543875863,-0.3474076256957803,
    1.0,-1.0,0.0,1.0,0.838717087751726,0.419358543875863,-0.3474076256957803,
    1.0,-1.0,0.0,1.0,0.838717087751726,0.419358543875863,0.34740762569578026,
    0.0,1.0,0.0,1.0,0.838717087751726,0.419358543875863,0.34740762569578026,
    0.7071070000000002,-1.0,0.7071070000000002,1.0,0.838717087751726,0.419358543875863,0.34740762569578026,
    0.7071070000000002,-1.0,0.7071070000000002,1.0,0.34740762569578026,0.419358543875863,0.838717087751726,
    0.0,1.0,0.0,1.0,0.34740762569578026,0.419358543875863,0.838717087751726,
    0.0,-1.0,1.0,1.0,0.34740762569578026,0.419358543875863,0.838717087751726,
    0.0,-1.0,1.0,1.0,-0.3474076256957803,0.419358543875863,0.838717087751726,
    0.0,1.0,0.0,1.0,-0.3474076256957803,0.419358543875863,0.838717087751726,
    -0.707107,-1.0,0.7071070000000002,1.0,-0.3474076256957803,0.419358543875863,0.838717087751726,
    -0.707107,-1.0,0.7071070000000002,1.0,-0.838717087751726,0.419358543875863,0.34740762569578043,
    0.0,1.0,0.0,1.0,-0.838717087751726,0.419358543875863,0.34740762569578043,
    -1.0,-1.0,0.0,1.0,-0.838717087751726,0.419358543875863,0.34740762569578043,
    0.7071070000000002,-1.0,0.7071070000000002,1.0,-0.0,-1.0,-0.0,
    -0.707107,-1.0,0.7071070000000002,1.0,-0.0,-1.0,-0.0,
    -0.707107,-1.0,-0.707107,1.0,-0.0,-1.0,-0.0,
    -1.0,-1.0,0.0,1.0,-0.8387170877517259,0.41935854387586297,-0.34740762569578043,
    0.0,1.0,0.0,1.0,-0.8387170877517259,0.41935854387586297,-0.34740762569578043,
    -0.707107,-1.0,-0.707107,1.0,-0.8387170877517259,0.41935854387586297,-0.34740762569578043,
    -0.707107,-1.0,-0.707107,1.0,-0.3474076256957805,0.419358543875863,-0.838717087751726,
    0.0,1.0,0.0,1.0,-0.3474076256957805,0.419358543875863,-0.838717087751726,
    0.0,-1.0,-1.0,1.0,-0.3474076256957805,0.419358543875863,-0.838717087751726,
    -0.707107,-1.0,-0.707107,1.0,0.0,-1.0,0.0,
    0.0,-1.0,-1.0,1.0,0.0,-1.0,0.0,
    0.7071070000000002,-1.0,-0.707107,1.0,0.0,-1.0,0.0,
    0.7071070000000002,-1.0,-0.707107,1.0,0.0,-1.0,0.0,
    1.0,-1.0,0.0,1.0,0.0,-1.0,0.0,
    0.7071070000000002,-1.0,0.7071070000000002,1.0,0.0,-1.0,0.0,
    0.7071070000000002,-1.0,0.7071070000000002,1.0,-0.0,-1.0,0.0,
    0.0,-1.0,1.0,1.0,-0.0,-1.0,0.0,
    -0.707107,-1.0,0.7071070000000002,1.0,-0.0,-1.0,0.0,
    -0.707107,-1.0,0.7071070000000002,1.0,0.0,-1.0,-0.0,
    -1.0,-1.0,0.0,1.0,0.0,-1.0,-0.0,
    -0.707107,-1.0,-0.707107,1.0,0.0,-1.0,-0.0,
    -0.707107,-1.0,-0.707107,1.0,0.0,-1.0,0.0,
    0.7071070000000002,-1.0,-0.707107,1.0,0.0,-1.0,0.0,
    0.7071070000000002,-1.0,0.7071070000000002,1.0,0.0,-1.0,0.0
  ])
  var colors = [
    1, 1, 1,
    .141, .953, .98,
    0, 0, 1,
    0, 0, 1,
    .141, .953, .98,
    1, 1, 1
  ];
  var colors_start = 0;
  for (i = 0; i < coneVerts.length; i+=7) {
    coneVerts[i+3] = 1.0;
    coneVerts[i+4] = colors[colors_start]
    coneVerts[i+5] = colors[colors_start + 1];
    coneVerts[i+6] = colors[colors_start + 2];
    if (colors_start == 15) {
      colors_start = 0;
    }
    else {
      colors_start += 3;
    }
  }
  coneLen = coneVerts.length/7;
};
function initBall() {
  ballVerts = new Float32Array ([
    0.48403299999999994,-1.0,-0.48403299999999994,1.0,-0.0,-1.0,-0.0,
    -0.48403299999999994,-1.0,0.48403299999999994,1.0,-0.0,-1.0,-0.0,
    -0.48403299999999994,-1.0,-0.48403299999999994,1.0,-0.0,-1.0,-0.0,
    -1.0,0.48403299999999994,0.48403299999999994,1.0,-1.0,-0.0,0.0,
    -1.0,-0.48403299999999994,-0.48403299999999994,1.0,-1.0,-0.0,0.0,
    -1.0,-0.48403299999999994,0.48403299999999994,1.0,-1.0,-0.0,0.0,
    0.48403299999999994,0.48403299999999994,1.0,1.0,-0.0,0.0,1.0,
    -0.48403299999999994,-0.48403299999999994,1.0,1.0,-0.0,0.0,1.0,
    0.48403299999999994,-0.48403299999999994,1.0,1.0,-0.0,0.0,1.0,
    -0.48403299999999994,1.0,-0.48403299999999994,1.0,-0.0,1.0,0.0,
    0.48403299999999994,1.0,0.48403299999999994,1.0,-0.0,1.0,0.0,
    0.48403299999999994,1.0,-0.48403299999999994,1.0,-0.0,1.0,0.0,
    1.0,0.48403299999999994,-0.48403299999999994,1.0,1.0,0.0,0.0,
    1.0,-0.48403299999999994,0.48403299999999994,1.0,1.0,0.0,0.0,
    1.0,-0.48403299999999994,-0.48403299999999994,1.0,1.0,0.0,0.0,
    0.48403299999999994,0.48403299999999994,-1.0,1.0,0.5773502691896258,0.5773502691896258,-0.5773502691896258,
    0.48403299999999994,1.0,-0.48403299999999994,1.0,0.5773502691896258,0.5773502691896258,-0.5773502691896258,
    1.0,0.48403299999999994,-0.48403299999999994,1.0,0.5773502691896258,0.5773502691896258,-0.5773502691896258,
    0.48403299999999994,-1.0,-0.48403299999999994,1.0,0.5773502691896258,-0.5773502691896258,-0.5773502691896258,
    0.48403299999999994,-0.48403299999999994,-1.0,1.0,0.5773502691896258,-0.5773502691896258,-0.5773502691896258,
    1.0,-0.48403299999999994,-0.48403299999999994,1.0,0.5773502691896258,-0.5773502691896258,-0.5773502691896258,
    1.0,0.48403299999999994,0.48403299999999994,1.0,0.5773502691896258,0.5773502691896258,0.5773502691896258,
    0.48403299999999994,1.0,0.48403299999999994,1.0,0.5773502691896258,0.5773502691896258,0.5773502691896258,
    0.48403299999999994,0.48403299999999994,1.0,1.0,0.5773502691896258,0.5773502691896258,0.5773502691896258,
    1.0,-0.48403299999999994,0.48403299999999994,1.0,0.5773502691896258,-0.5773502691896258,0.5773502691896258,
    0.48403299999999994,-0.48403299999999994,1.0,1.0,0.5773502691896258,-0.5773502691896258,0.5773502691896258,
    0.48403299999999994,-1.0,0.48403299999999994,1.0,0.5773502691896258,-0.5773502691896258,0.5773502691896258,
    -0.48403299999999994,0.48403299999999994,-1.0,1.0,-0.5773502691896258,0.5773502691896258,-0.5773502691896258,
    -1.0,0.48403299999999994,-0.48403299999999994,1.0,-0.5773502691896258,0.5773502691896258,-0.5773502691896258,
    -0.48403299999999994,1.0,-0.48403299999999994,1.0,-0.5773502691896258,0.5773502691896258,-0.5773502691896258,
    -1.0,-0.48403299999999994,-0.48403299999999994,1.0,-0.5773502691896258,-0.5773502691896258,-0.5773502691896258,
    -0.48403299999999994,-0.48403299999999994,-1.0,1.0,-0.5773502691896258,-0.5773502691896258,-0.5773502691896258,
    -0.48403299999999994,-1.0,-0.48403299999999994,1.0,-0.5773502691896258,-0.5773502691896258,-0.5773502691896258,
    -1.0,0.48403299999999994,0.48403299999999994,1.0,-0.5773502691896258,0.5773502691896258,0.5773502691896258,
    -0.48403299999999994,0.48403299999999994,1.0,1.0,-0.5773502691896258,0.5773502691896258,0.5773502691896258,
    -0.48403299999999994,1.0,0.48403299999999994,1.0,-0.5773502691896258,0.5773502691896258,0.5773502691896258,
    -0.48403299999999994,-1.0,0.48403299999999994,1.0,-0.5773502691896258,-0.5773502691896258,0.5773502691896258,
    -0.48403299999999994,-0.48403299999999994,1.0,1.0,-0.5773502691896258,-0.5773502691896258,0.5773502691896258,
    -1.0,-0.48403299999999994,0.48403299999999994,1.0,-0.5773502691896258,-0.5773502691896258,0.5773502691896258,
    -0.48403299999999994,-1.0,0.48403299999999994,1.0,-0.7071067811865475,-0.7071067811865475,0.0,
    -1.0,-0.48403299999999994,-0.48403299999999994,1.0,-0.7071067811865475,-0.7071067811865475,0.0,
    -0.48403299999999994,-1.0,-0.48403299999999994,1.0,-0.7071067811865475,-0.7071067811865475,0.0,
    -0.48403299999999994,-1.0,-0.48403299999999994,1.0,0.0,-0.7071067811865475,-0.7071067811865475,
    0.48403299999999994,-0.48403299999999994,-1.0,1.0,0.0,-0.7071067811865475,-0.7071067811865475,
    0.48403299999999994,-1.0,-0.48403299999999994,1.0,0.0,-0.7071067811865475,-0.7071067811865475,
    1.0,-0.48403299999999994,-0.48403299999999994,1.0,0.7071067811865475,0.0,-0.7071067811865475,
    0.48403299999999994,0.48403299999999994,-1.0,1.0,0.7071067811865475,0.0,-0.7071067811865475,
    1.0,0.48403299999999994,-0.48403299999999994,1.0,0.7071067811865475,0.0,-0.7071067811865475,
    -0.48403299999999994,0.48403299999999994,1.0,1.0,-0.7071067811865475,0.0,0.7071067811865475,
    -1.0,-0.48403299999999994,0.48403299999999994,1.0,-0.7071067811865475,0.0,0.7071067811865475,
    -0.48403299999999994,-0.48403299999999994,1.0,1.0,-0.7071067811865475,0.0,0.7071067811865475,
    0.48403299999999994,-0.48403299999999994,1.0,1.0,0.7071067811865475,0.0,0.7071067811865475,
    1.0,0.48403299999999994,0.48403299999999994,1.0,0.7071067811865475,0.0,0.7071067811865475,
    0.48403299999999994,0.48403299999999994,1.0,1.0,0.7071067811865475,0.0,0.7071067811865475,
    -0.48403299999999994,-0.48403299999999994,-1.0,1.0,-0.7071067811865475,0.0,-0.7071067811865475,
    -1.0,0.48403299999999994,-0.48403299999999994,1.0,-0.7071067811865475,0.0,-0.7071067811865475,
    -0.48403299999999994,0.48403299999999994,-1.0,1.0,-0.7071067811865475,0.0,-0.7071067811865475,
    -0.48403299999999994,1.0,0.48403299999999994,1.0,0.0,0.7071067811865475,0.7071067811865475,
    0.48403299999999994,0.48403299999999994,1.0,1.0,0.0,0.7071067811865475,0.7071067811865475,
    0.48403299999999994,1.0,0.48403299999999994,1.0,0.0,0.7071067811865475,0.7071067811865475,
    0.48403299999999994,1.0,0.48403299999999994,1.0,0.7071067811865475,0.7071067811865475,0.0,
    1.0,0.48403299999999994,-0.48403299999999994,1.0,0.7071067811865475,0.7071067811865475,0.0,
    0.48403299999999994,1.0,-0.48403299999999994,1.0,0.7071067811865475,0.7071067811865475,0.0,
    0.48403299999999994,-1.0,0.48403299999999994,1.0,0.0,-0.7071067811865475,0.7071067811865475,
    -0.48403299999999994,-0.48403299999999994,1.0,1.0,0.0,-0.7071067811865475,0.7071067811865475,
    -0.48403299999999994,-1.0,0.48403299999999994,1.0,0.0,-0.7071067811865475,0.7071067811865475,
    -0.48403299999999994,1.0,-0.48403299999999994,1.0,-0.7071067811865475,0.7071067811865475,0.0,
    -1.0,0.48403299999999994,0.48403299999999994,1.0,-0.7071067811865475,0.7071067811865475,0.0,
    -0.48403299999999994,1.0,0.48403299999999994,1.0,-0.7071067811865475,0.7071067811865475,0.0,
    0.48403299999999994,1.0,-0.48403299999999994,1.0,0.0,0.7071067811865475,-0.7071067811865475,
    -0.48403299999999994,0.48403299999999994,-1.0,1.0,0.0,0.7071067811865475,-0.7071067811865475,
    -0.48403299999999994,1.0,-0.48403299999999994,1.0,0.0,0.7071067811865475,-0.7071067811865475,
    0.48403299999999994,-1.0,-0.48403299999999994,1.0,0.7071067811865475,-0.7071067811865475,0.0,
    1.0,-0.48403299999999994,0.48403299999999994,1.0,0.7071067811865475,-0.7071067811865475,0.0,
    0.48403299999999994,-1.0,0.48403299999999994,1.0,0.7071067811865475,-0.7071067811865475,0.0,
    -0.48403299999999994,0.48403299999999994,-1.0,1.0,-0.0,-0.0,-1.0,
    0.48403299999999994,-0.48403299999999994,-1.0,1.0,-0.0,-0.0,-1.0,
    -0.48403299999999994,-0.48403299999999994,-1.0,1.0,-0.0,-0.0,-1.0,
    0.48403299999999994,-1.0,-0.48403299999999994,1.0,0.0,-1.0,0.0,
    0.48403299999999994,-1.0,0.48403299999999994,1.0,0.0,-1.0,0.0,
    -0.48403299999999994,-1.0,0.48403299999999994,1.0,0.0,-1.0,0.0,
    -1.0,0.48403299999999994,0.48403299999999994,1.0,-1.0,-0.0,-0.0,
    -1.0,0.48403299999999994,-0.48403299999999994,1.0,-1.0,-0.0,-0.0,
    -1.0,-0.48403299999999994,-0.48403299999999994,1.0,-1.0,-0.0,-0.0,
    0.48403299999999994,0.48403299999999994,1.0,1.0,0.0,0.0,1.0,
    -0.48403299999999994,0.48403299999999994,1.0,1.0,0.0,0.0,1.0,
    -0.48403299999999994,-0.48403299999999994,1.0,1.0,0.0,0.0,1.0,
    -0.48403299999999994,1.0,-0.48403299999999994,1.0,0.0,1.0,0.0,
    -0.48403299999999994,1.0,0.48403299999999994,1.0,0.0,1.0,0.0,
    0.48403299999999994,1.0,0.48403299999999994,1.0,0.0,1.0,0.0,
    1.0,0.48403299999999994,-0.48403299999999994,1.0,1.0,0.0,-0.0,
    1.0,0.48403299999999994,0.48403299999999994,1.0,1.0,0.0,-0.0,
    1.0,-0.48403299999999994,0.48403299999999994,1.0,1.0,0.0,-0.0,
    -0.48403299999999994,-1.0,0.48403299999999994,1.0,-0.7071067811865475,-0.7071067811865475,-0.0,
    -1.0,-0.48403299999999994,0.48403299999999994,1.0,-0.7071067811865475,-0.7071067811865475,-0.0,
    -1.0,-0.48403299999999994,-0.48403299999999994,1.0,-0.7071067811865475,-0.7071067811865475,-0.0,
    -0.48403299999999994,-1.0,-0.48403299999999994,1.0,0.0,-0.7071067811865475,-0.7071067811865475,
    -0.48403299999999994,-0.48403299999999994,-1.0,1.0,0.0,-0.7071067811865475,-0.7071067811865475,
    0.48403299999999994,-0.48403299999999994,-1.0,1.0,0.0,-0.7071067811865475,-0.7071067811865475,
    1.0,-0.48403299999999994,-0.48403299999999994,1.0,0.7071067811865475,0.0,-0.7071067811865475,
    0.48403299999999994,-0.48403299999999994,-1.0,1.0,0.7071067811865475,0.0,-0.7071067811865475,
    0.48403299999999994,0.48403299999999994,-1.0,1.0,0.7071067811865475,0.0,-0.7071067811865475,
    -0.48403299999999994,0.48403299999999994,1.0,1.0,-0.7071067811865475,0.0,0.7071067811865475,
    -1.0,0.48403299999999994,0.48403299999999994,1.0,-0.7071067811865475,0.0,0.7071067811865475,
    -1.0,-0.48403299999999994,0.48403299999999994,1.0,-0.7071067811865475,0.0,0.7071067811865475,
    0.48403299999999994,-0.48403299999999994,1.0,1.0,0.7071067811865475,-0.0,0.7071067811865475,
    1.0,-0.48403299999999994,0.48403299999999994,1.0,0.7071067811865475,-0.0,0.7071067811865475,
    1.0,0.48403299999999994,0.48403299999999994,1.0,0.7071067811865475,-0.0,0.7071067811865475,
    -0.48403299999999994,-0.48403299999999994,-1.0,1.0,-0.7071067811865475,0.0,-0.7071067811865475,
    -1.0,-0.48403299999999994,-0.48403299999999994,1.0,-0.7071067811865475,0.0,-0.7071067811865475,
    -1.0,0.48403299999999994,-0.48403299999999994,1.0,-0.7071067811865475,0.0,-0.7071067811865475,
    -0.48403299999999994,1.0,0.48403299999999994,1.0,-0.0,0.7071067811865475,0.7071067811865475,
    -0.48403299999999994,0.48403299999999994,1.0,1.0,-0.0,0.7071067811865475,0.7071067811865475,
    0.48403299999999994,0.48403299999999994,1.0,1.0,-0.0,0.7071067811865475,0.7071067811865475,
    0.48403299999999994,1.0,0.48403299999999994,1.0,0.7071067811865475,0.7071067811865475,0.0,
    1.0,0.48403299999999994,0.48403299999999994,1.0,0.7071067811865475,0.7071067811865475,0.0,
    1.0,0.48403299999999994,-0.48403299999999994,1.0,0.7071067811865475,0.7071067811865475,0.0,
    0.48403299999999994,-1.0,0.48403299999999994,1.0,0.0,-0.7071067811865475,0.7071067811865475,
    0.48403299999999994,-0.48403299999999994,1.0,1.0,0.0,-0.7071067811865475,0.7071067811865475,
    -0.48403299999999994,-0.48403299999999994,1.0,1.0,0.0,-0.7071067811865475,0.7071067811865475,
    -0.48403299999999994,1.0,-0.48403299999999994,1.0,-0.7071067811865475,0.7071067811865475,0.0,
    -1.0,0.48403299999999994,-0.48403299999999994,1.0,-0.7071067811865475,0.7071067811865475,0.0,
    -1.0,0.48403299999999994,0.48403299999999994,1.0,-0.7071067811865475,0.7071067811865475,0.0,
    0.48403299999999994,1.0,-0.48403299999999994,1.0,0.0,0.7071067811865475,-0.7071067811865475,
    0.48403299999999994,0.48403299999999994,-1.0,1.0,0.0,0.7071067811865475,-0.7071067811865475,
    -0.48403299999999994,0.48403299999999994,-1.0,1.0,0.0,0.7071067811865475,-0.7071067811865475,
    0.48403299999999994,-1.0,-0.48403299999999994,1.0,0.7071067811865475,-0.7071067811865475,0.0,
    1.0,-0.48403299999999994,-0.48403299999999994,1.0,0.7071067811865475,-0.7071067811865475,0.0,
    1.0,-0.48403299999999994,0.48403299999999994,1.0,0.7071067811865475,-0.7071067811865475,0.0,
    -0.48403299999999994,0.48403299999999994,-1.0,1.0,0.0,0.0,-1.0,
    0.48403299999999994,0.48403299999999994,-1.0,1.0,0.0,0.0,-1.0,
    0.48403299999999994,-0.48403299999999994,-1.0,1.0,0.0,0.0,-1.0
  ])
  var colors = [
    1, 1, 1,
    .141, .953, .98,
    0, 0, 1,
    0, 0, 1,
    .141, .953, .98,
    1, 1, 1
  ];
  var colors_start = 0;
  for (i = 0; i < ballVerts.length; i+=7) {
    ballVerts[i+3] = 1.0;
    ballVerts[i+4] = colors[colors_start]
    ballVerts[i+5] = colors[colors_start + 1];
    ballVerts[i+6] = colors[colors_start + 2];
    if (colors_start == 15) {
      colors_start = 0;
    }
    else {
      colors_start += 3;
    }
  }
  ballLen = ballVerts.length/7;
};

//Separate Model, View, Projection Matrices? 
function draw() {
//==============================================================================
// re-draw contents of all viewports.

  // Clear color and depth buffer for ENTIRE GPU drawing buffer:
  // (careful! clears contents of ALL viewports!)
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
  g_mvpMatrix.setIdentity();
  //LEFT VIEWPORT --------------------------------------------------------------
  setLeftViewPort(); //Set world coords for left viewport
  pushMatrix(g_mvpMatrix); //Save world coords
    drawScene(); //draw the scene
  g_mvpMatrix = popMatrix(); //return to world coords

//RIGHT VIEWPORT ---------------------------------------------------------------
  setRightViewPort();//Set world coords for right viewport
  pushMatrix(g_mvpMatrix);
    drawScene();
  g_mvpMatrix = popMatrix();
  
}
var ModelMatrix = new Matrix4();
var coords = new Vector4([-0.07474541032512982,-1.0,0.04872582694607064,1.0]);
function drawScene() {
  drawGrid();
  drawAxes();

  // Draw Crane
  pushMatrix(g_mvpMatrix)
    g_mvpMatrix.rotate(-90, 1, 0, 0);
    g_mvpMatrix.translate(35, -8, 5)
    g_mvpMatrix.scale(3, 3, 3);
    drawArm();

    g_mvpMatrix.translate(0, -1, 0);
    g_mvpMatrix.rotate(-45, 1, 0, 0);
    g_mvpMatrix.rotate(armj1_anglenow, 1, 0, 0); //Set max at 0?
    g_mvpMatrix.translate(0, -1, 0)
    drawArm();

    g_mvpMatrix.translate(0, -1, 0);
    g_mvpMatrix.rotate(-45, 1, 0, 0);
    g_mvpMatrix.rotate(armj2_anglenow, 0, 0, 1);
    g_mvpMatrix.translate(0, -1, 0);
    drawArm();

    g_mvpMatrix.scale(.66, .66, .66);
    g_mvpMatrix.translate(-.15, -1.6, 0);
    g_mvpMatrix.rotate(90, 1, 0, 0);
    g_mvpMatrix.rotate(armj3_anglenow, 0, 0, 1);
    drawArm();

    pushMatrix(g_mvpMatrix);
      g_mvpMatrix.scale(.6, .6, .6);
      g_mvpMatrix.translate(0, 2.6, 0);
      drawAxes();
      drawDiamond();
    g_mvpMatrix = popMatrix();

    g_mvpMatrix.scale(.6, .6, .6);
    g_mvpMatrix.translate(-.05, -2.6, -.05);
    drawDiamond();
    
  g_mvpMatrix = popMatrix();
  pushMatrix(g_mvpMatrix);
    g_mvpMatrix.scale(6, 6, 6);
    g_mvpMatrix.translate(-5, 3, 1);
    g_mvpMatrix.rotate(tor_anglenow, 0, 0, 1);
    drawTorus();
    g_mvpMatrix.scale(4/6, 4/6, 4/6);
    g_mvpMatrix.rotate(90, 0, 0, 1);
    g_mvpMatrix.rotate(tor_anglenow, 0, 0, 1)
    drawTorus();
    g_mvpMatrix.scale(4/6, 4/6, 4/6);
    g_mvpMatrix.rotate(90, 1, 0, 0);
    g_mvpMatrix.rotate(tor_anglenow, 0, 0, 1);
    drawAxes();
    drawTorus();
  g_mvpMatrix = popMatrix();

  pushMatrix(g_mvpMatrix);
    g_mvpMatrix.translate(-12, -25, 3);
    g_mvpMatrix.scale(3, 3, 3);
    drawAxes();
    quatMatrix.setFromQuat(qTot.x, qTot.y, qTot.z, qTot.w);
    g_mvpMatrix.concat(quatMatrix);
    //g_mvpMatrix.rotate(armj3_anglenow, .04, 0, 0);
    drawIso();
    drawAxes();
    g_mvpMatrix.translate(0, 0, 1);
    g_mvpMatrix.rotate(tor1_anglenow, 1, 0, 0);
    g_mvpMatrix.translate(0, 0, 1);
    drawTorus();
    drawAxes();
    pushMatrix(g_mvpMatrix); // pushtor
      g_mvpMatrix.translate(-1, 0, 0);
      g_mvpMatrix.rotate(90, 0, 0, 1);
      g_mvpMatrix.translate(0, 1, 0);
      drawWing();

      pushMatrix(g_mvpMatrix);//push w1
        g_mvpMatrix.scale(.4, .4, .4);
        g_mvpMatrix.rotate(90, 1, 0, 0);
        g_mvpMatrix.translate(0, -.5, 1);
        g_mvpMatrix.rotate(drop_anglenow, 1, 0, 0);
        g_mvpMatrix.translate(0, -1.3, 0);
        drawDrop();
      g_mvpMatrix = popMatrix();//pop to w1

      g_mvpMatrix.scale(.4, .4, .4);
      g_mvpMatrix.rotate(90, 1, 0, 0);
      g_mvpMatrix.translate(0, -.5, -1);
      g_mvpMatrix.rotate(drop_anglenow, 1, 0, 0);
      g_mvpMatrix.translate(0, -1.3, 0);
      drawDrop();
    g_mvpMatrix = popMatrix();//pop to tor

    g_mvpMatrix.translate(1, 0, 0);
    g_mvpMatrix.rotate(-90, 0, 0, 1);
    g_mvpMatrix.translate(0, 1, 0);
    drawWing();

    pushMatrix(g_mvpMatrix);//push w2
        g_mvpMatrix.scale(.4, .4, .4);
        g_mvpMatrix.rotate(90, 1, 0, 0);
        g_mvpMatrix.translate(0, -.5, 1);
        g_mvpMatrix.rotate(drop_anglenow, 1, 0, 0);
        g_mvpMatrix.translate(0, -1.3, 0);
        drawDrop();
    g_mvpMatrix = popMatrix();//pop to w2

      g_mvpMatrix.scale(.4, .4, .4);
      g_mvpMatrix.rotate(90, 1, 0, 0);
      g_mvpMatrix.translate(0, -.5, -1);
      g_mvpMatrix.rotate(drop_anglenow, 1, 0, 0);
      g_mvpMatrix.translate(0, -1.3, 0);
      drawDrop();
  g_mvpMatrix = popMatrix();//pop to cvv
  pushMatrix(g_mvpMatrix);
    g_mvpMatrix.scale(3, 3, 3);
    g_mvpMatrix.translate(1, 8, ballz);
    g_mvpMatrix.rotate(ball_anglenow, 1, 1, 1)
    drawBall();
    pushMatrix(g_mvpMatrix);
      g_mvpMatrix.scale(.5, .5, .5);
      g_mvpMatrix.translate(0, -3, 0);
      g_mvpMatrix.rotate(180, 1, 0, 0);
      drawCone();
    g_mvpMatrix = popMatrix();
    pushMatrix(g_mvpMatrix);
      g_mvpMatrix.scale(.5, .5, .5);
      g_mvpMatrix.translate(0, 3, 0);
      drawCone();
    g_mvpMatrix = popMatrix();
    pushMatrix(g_mvpMatrix);
      g_mvpMatrix.scale(.5, .5, .5);
      g_mvpMatrix.translate(0, 0, 3);
      g_mvpMatrix.rotate(90, 1, 0, 0);
      drawCone();
    g_mvpMatrix = popMatrix();
    pushMatrix(g_mvpMatrix);
      g_mvpMatrix.scale(.5, .5, .5);
      g_mvpMatrix.translate(0, 0, -3);
      g_mvpMatrix.rotate(-90, 1, 0, 0);
      drawCone();
    g_mvpMatrix = popMatrix();
    pushMatrix(g_mvpMatrix);
      g_mvpMatrix.scale(.5, .5, .5);
      g_mvpMatrix.translate(3, 0, 0);
      g_mvpMatrix.rotate(-90, 0, 0, 1);
      drawCone();
    g_mvpMatrix = popMatrix();
    pushMatrix(g_mvpMatrix);
      g_mvpMatrix.scale(.5, .5, .5);
      g_mvpMatrix.translate(-3, 0, 0);
      g_mvpMatrix.rotate(90, 0, 0, 1);
      drawCone();
    g_mvpMatrix = popMatrix();
  g_mvpMatrix = popMatrix();
  
};
//VIEWPORT/CAMERA FUNCTIONS
function setLeftViewPort() {
    	//----------------------Create, fill left viewport------------------------
    gl.viewport(0, 0, g_canvas.width/2, g_canvas.height); //LLx, LLy, Width, Height			

    var vpAspect = (g_canvas.width/2) / g_canvas.height;	//Aspect Ratio
  if (obj_view == true) {
    ModelMatrix.setIdentity();
    ModelMatrix.rotate(-90, 1, 0, 0);
    ModelMatrix.translate(20, -5, 5)
    ModelMatrix.scale(3, 3, 3);
    ModelMatrix.translate(0, -1, 0);
    ModelMatrix.rotate(-45, 1, 0, 0);
    ModelMatrix.rotate(armj1_anglenow, 1, 0, 0); //Set max at 0?
    ModelMatrix.translate(0, -1, 0)
    ModelMatrix.translate(0, -1, 0);
    ModelMatrix.rotate(-45, 1, 0, 0);
    ModelMatrix.rotate(armj2_anglenow, 0, 0, 1);
    ModelMatrix.translate(0, -1, 0);

    ModelMatrix.scale(.66, .66, .66);
    ModelMatrix.translate(-.15, -1.6, 0);
    ModelMatrix.rotate(90, 1, 0, 0);
    ModelMatrix.rotate(armj3_anglenow, 0, 0, 1);
    ModelMatrix.printMe();
    //1x4 x 4x4
    // 0 4 8 12
    // 1 5 9 13
    // 2 6 10 14
    // 3 7 11 15
    var a = coords.elements[0] * ModelMatrix.elements[0] + coords.elements[1] * ModelMatrix.elements[1] + coords.elements[2] * ModelMatrix.elements[2]
    + coords.elements[3] * ModelMatrix.elements[3]
    var b = coords.elements[0] * ModelMatrix.elements[4] + coords.elements[1] * ModelMatrix.elements[5] + coords.elements[2] * ModelMatrix.elements[6]
    + coords.elements[3] * ModelMatrix.elements[7]
    var c = coords.elements[0] * ModelMatrix.elements[8] + coords.elements[1] * ModelMatrix.elements[9] + coords.elements[2] * ModelMatrix.elements[10]
    + coords.elements[3] * ModelMatrix.elements[11]
    g_mvpMatrix.setPerspective(frust_angle, vpAspect, near, far);
    g_mvpMatrix.lookAt(	a, b, c,
      // 'Center' or 'Eye Point',
     aim.elements[0], aim.elements[1], aim.elements[2],					// look-At point,
 up.elements[0], up.elements[1], up.elements[2]);	
  }
  else {
// For this viewport, set camera's eye point and the viewing volume:
    g_mvpMatrix.setPerspective(frust_angle,			// fovy: y-axis field-of-view in degrees 	
                                                  // (top <-> bottom in view frustum)
                              vpAspect, // aspect ratio: width/height
                              near, far);	// near, far (always >0).
    //calculate new aim:
      //camera movement back/forth - theta stays constant, eyex changes
      //camera aim rotation - theta changes, eyex stays same
      //camera strafe - cross with up and aim
    g_mvpMatrix.lookAt(	eye.elements[0], eye.elements[1], eye.elements[2],
           				// 'Center' or 'Eye Point',
                  aim.elements[0], aim.elements[1], aim.elements[2],					// look-At point,
              up.elements[0], up.elements[1], up.elements[2]);	
    				}				// View UP vector, all in 'world' coords.
  /*
    console.log("eye:", eye.elements);
    console.log("theta", theta);
    console.log("deltaz", deltaZ);
  */
};

function setRightViewPort() {
	//----------------------Create, fill rigth viewport------------------------
	gl.viewport(g_canvas.width/2, 0, g_canvas.width/2, g_canvas.height); //LLx, LLy, Width, Height			 

	vpAspect = (g_canvas.width/2) /	g_canvas.height; //Aspect Ratio

  orthoH = 2 * (far - near)/3 * Math.tan((frust_angle/2) * Math.PI/180);
  orthoW = orthoH * vpAspect; //? 
  g_mvpMatrix.setOrtho(-1 * orthoW/2, orthoW/2, -1 * orthoH/2, orthoH/2, near, far);
  //g_mvpMatrix.ortho(0, orthoW, 0, orthoH, -near, -far);
  // For this viewport, set camera's eye point and the viewing volume:
  
  g_mvpMatrix.lookAt(	eye.elements[0], eye.elements[1], eye.elements[2],
           				// 'Center' or 'Eye Point',
                        aim.elements[0], aim.elements[1], aim.elements[2],					// look-At point,
                        up.elements[0], up.elements[1], up.elements[2]);					// View UP vector, all in 'world' coords.
                        
}

//INDIVIDUAL DRAWING FUNCTIONS
function drawGrid() {
    gl.uniformMatrix4fv(g_mvpMatrixLoc, false, g_mvpMatrix.elements);
    gl.drawArrays(gl.LINES, gridStart, gndVertsLen);
};
function drawAxes(){
  gl.uniformMatrix4fv(g_mvpMatrixLoc, false, g_mvpMatrix.elements);
  gl.drawArrays(gl.LINES, axesStart, axesVertsLen);
};
function drawArm() {
    gl.uniformMatrix4fv(g_mvpMatrixLoc, false, g_mvpMatrix.elements);
    gl.drawArrays(gl.TRIANGLES, armStart, armLen);
};
function drawDiamond() {
  gl.uniformMatrix4fv(g_mvpMatrixLoc, false, g_mvpMatrix.elements);
  gl.drawArrays(gl.TRIANGLES, diaStart, diaLen);
};
function drawTorus() {
  gl.uniformMatrix4fv(g_mvpMatrixLoc, false, g_mvpMatrix.elements);
  gl.drawArrays(gl.TRIANGLES, torStart, torLen);
};
function drawIso() {
  gl.uniformMatrix4fv(g_mvpMatrixLoc, false, g_mvpMatrix.elements);
  gl.drawArrays(gl.TRIANGLES, isoStart, isoLen);
};
function drawWing() {
  gl.uniformMatrix4fv(g_mvpMatrixLoc, false, g_mvpMatrix.elements);
  gl.drawArrays(gl.TRIANGLES, wingStart, wingLen);
};
function drawDrop() {
  gl.uniformMatrix4fv(g_mvpMatrixLoc, false, g_mvpMatrix.elements);
  gl.drawArrays(gl.TRIANGLES, dropStart, dropLen);
};
function drawCone() {
  gl.uniformMatrix4fv(g_mvpMatrixLoc, false, g_mvpMatrix.elements);
  gl.drawArrays(gl.TRIANGLES, coneStart, coneLen);
};
function drawBall() {
  gl.uniformMatrix4fv(g_mvpMatrixLoc, false, g_mvpMatrix.elements);
  gl.drawArrays(gl.TRIANGLES, ballStart, ballLen);
};


function drawResize() {
//==============================================================================
// Called when user re-sizes their browser window , because our HTML file
// contains:  <body onload="main()" onresize="winResize()">

	//Report our current browser-window contents:

	//console.log('g_Canvas width,height=', g_canvas.width, g_canvas.height);		
  //console.log('Browser window: innerWidth,innerHeight=', 
	//															innerWidth, innerHeight);	
																// http://www.w3schools.com/jsref/obj_window.asp

	
	//Make canvas fill the top 3/4 of our browser window:
	var xtraMargin = 16;    // keep a margin (otherwise, browser adds scroll-bars)
	g_canvas.width = innerWidth - xtraMargin;
	g_canvas.height = (innerHeight*2/3) - xtraMargin;
  aim.elements[0] = eye.elements[0] + Math.cos(theta);
  aim.elements[1] = eye.elements[1] + Math.sin(theta);
  aim.elements[2] = eye.elements[2] + deltaZ;
  draw();
}

function dragQuat(xdrag, ydrag) {
  //==============================================================================
  // Called when user drags mouse by 'xdrag,ydrag' as measured in CVV coords.
  // We find a rotation axis perpendicular to the drag direction, and convert the 
  // drag distance to an angular rotation amount, and use both to set the value of 
  // the quaternion qNew.  We then combine this new rotation with the current 
  // rotation stored in quaternion 'qTot' by quaternion multiply.  Note the 
  // 'draw()' function converts this current 'qTot' quaternion to a rotation 
  // matrix for drawing. 
    var res = 5;
    var qRot = new Quaternion(0, 0, 0, 1);
    var qTmp = new Quaternion(0,0,0,1);
    var dist = Math.sqrt(xdrag*xdrag + ydrag*ydrag);
    // console.log('xdrag,ydrag=',xdrag.toFixed(5),ydrag.toFixed(5),'dist=',dist.toFixed(5));
    rotation = new Vector3([-ydrag, xdrag, 0]);
    temp_vec = new Vector3([aim.elements[0] - eye.elements[0], aim.elements[1] - eye.elements[1], aim.elements[2] - eye.elements[2]]);
    dir = rotation.cross(temp_vec);
    //try doing with xvec, yvec, zvec i.e (1, 0, 0), (0, 1, 0) (0, 0, 1)
    /*
    temp_vecx = new Vector3([aim.elements[0] - eye.elements[0], 0, 0]);
    temp_vecy = new Vector3([0, aim.elements[1] - eye.elements[1], 0]);
    temp_vecz = new Vector3([0, 0, aim.elements[2] - eye.elements[2]]);
    dirx = temp_vecx.cross(rotation);
    diry = temp_vecy.cross(rotation);
    dirz = temp_vecz.cross(rotation);
    */
   //LEFT AND RIGHT DRAGGING AROUND Z??  
    xvec = new Vector3([1, 0, 0]);
    yvec = new Vector3([0, 1, 0]);
    xaxis = temp_vec.cross(up).normalize();
    qNew.setFromAxisAngle(xaxis.elements[1] + .0001, xaxis.elements[0] + .0001, 0, ydrag * 150);
    //qNew2.setFromAxisAngle(aim.elements[0] - eye.elements[0], aim.elements[1] - eye.elements[1], aim.elements[2] - eye.elements[2], xdrag * 150);
    qNew2.setFromAxisAngle(0 + .0001, 0 + .0001, 1, xdrag*150);

    //drag in -x, rotation about camera y
    //ydrag * xaxis.elements[0]
    //qNew.setFromAxisAngle(-dir.elements[1] + .0001, -dir.elements[0] + .0001, 0, dist * 150);
    //qNew.setFromAxisAngle(xdrag * Math.cos(theta) + 0.0001, -ydrag * Math.sin(theta) + 0.0001, 0, dist*150.0);
    //qNew.setFromAxisAngle(dirx.elements[0] + .0001, diry.elements[1] + .0001, 0, dist * 150);
    // (why add tiny 0.0001? To ensure we never have a zero-length rotation axis)
                // why axis (x,y,z) = (-yMdrag,+xMdrag,0)? 
                // -- to rotate around +x axis, drag mouse in -y direction.
                // -- to rotate around +y axis, drag mouse in +x direction.
                
    qRot.multiply(qNew,qNew2);
    qTmp.multiply(qRot, qTot);		// apply new rotation to current rotation. 
    //--------------------------
    // IMPORTANT! Why qNew*qTot instead of qTot*qNew? (Try it!)
    // ANSWER: Because 'duality' governs ALL transformations, not just matrices. 
    // If we multiplied in (qTot*qNew) order, we would rotate the drawing axes
    // first by qTot, and then by qNew--we would apply mouse-dragging rotations
    // to already-rotated drawing axes.  Instead, we wish to apply the mouse-drag
    // rotations FIRST, before we apply rotations from all the previous dragging.
    //------------------------
    // IMPORTANT!  Both qTot and qNew are unit-length quaternions, but we store 
    // them with finite precision. While the product of two (EXACTLY) unit-length
    // quaternions will always be another unit-length quaternion, the qTmp length
    // may drift away from 1.0 if we repeat this quaternion multiply many times.
    // A non-unit-length quaternion won't work with our quaternion-to-matrix fcn.
    // Matrix4.prototype.setFromQuat().
  //	qTmp.normalize();						// normalize to ensure we stay at length==1.0.
    qTot.copy(qTmp);
    // show the new quaternion qTot on our webpage in the <div> element 'QuatValue'
};
var obj_view = false;
function myKeyDown(kev) {
  console.log(  "--kev.code:",    kev.code,   "\t\t--kev.key:",     kev.key, 
	"\n--kev.ctrlKey:", kev.ctrlKey,  "\t--kev.shiftKey:",kev.shiftKey,
	"\n--kev.altKey:",  kev.altKey,   "\t--kev.metaKey:", kev.metaKey);

  switch(kev.code) {
    case "ArrowUp":
      deltaZ += .025;
      break;
    case "ArrowDown":
      deltaZ -= .025;
      break;
    case "ArrowLeft":
      theta += .01;
      break;
    case "ArrowRight":
      theta -= .01;
      break;
    case "KeyW":
      dx = (aim.elements[0] - eye.elements[0]) * velocity;
      dy = (aim.elements[1] - eye.elements[1]) * velocity;
      dz = (aim.elements[2] - eye.elements[2]) * velocity
      eye.elements[0] += dx;
      eye.elements[1] += dy;
      eye.elements[2] += dz;
      aim.elements[0] += dx;
      aim.elements[1] += dy;
      aim.elements[2] += dz;
      break;
    case "KeyS":
      dx = (aim.elements[0] - eye.elements[0]) * velocity;
      dy = (aim.elements[1] - eye.elements[1]) * velocity;
      dz = (aim.elements[2] - eye.elements[2]) * velocity
      eye.elements[0] -= dx;
      eye.elements[1] -= dy;
      eye.elements[2] -= dz;
      aim.elements[0] -= dx;
      aim.elements[1] -= dy;
      aim.elements[2] -= dz;
      break;
    case "KeyA":
      temp_vec = new Vector3([eye.elements[0] - aim.elements[0],
                              eye.elements[1] - aim.elements[1],
                              eye.elements[2] - aim.elements[2]]);
      dir = temp_vec.cross(up).normalize();
      eye.elements[0] += velocity * dir.elements[0];
      eye.elements[1] += velocity * dir.elements[1];
      eye.elements[2] += velocity * dir.elements[2];
      aim.elements[0] += velocity * dir.elements[0];
      aim.elements[1] += velocity * dir.elements[1];
      aim.elements[2] += velocity * dir.elements[2];
      break;
    case "KeyD":
      temp_vec = new Vector3([eye.elements[0] - aim.elements[0],
                              eye.elements[1] - aim.elements[1],
                              eye.elements[2] - aim.elements[2]]);
      dir = temp_vec.cross(up).normalize();
      eye.elements[0] -= velocity * dir.elements[0];
      eye.elements[1] -= velocity * dir.elements[1];
      eye.elements[2] -= velocity * dir.elements[2];
      aim.elements[0] -= velocity * dir.elements[0];
      aim.elements[1] -= velocity * dir.elements[1];
      aim.elements[2] -= velocity * dir.elements[2];
      break;
    case "KeyO":
      if (obj_view == true) {
        obj_view = false;
      }
      else {
        obj_view = true;
      }
      break;
  }
}
function myMouseDown(ev, gl, g_canvas){
	var rect = ev.target.getBoundingClientRect();
	var xp = ev.clientX - rect.left;
	var yp = g_canvas.height - (ev.clientY - rect.top);

	var x = (xp - g_canvas.width/2) / (g_canvas.width/2);
	var y = (yp - g_canvas.height/2) / (g_canvas.height/2);

	g_isDrag = true;
	g_xMclik = x;
	g_yMclik = y;
}

function myMouseMove(ev, gl, g_canvas) {
	if(g_isDrag == false)
		return;

	var rect = ev.target.getBoundingClientRect();
	var xp = ev.clientX - rect.left;
	var yp = g_canvas.height - (ev.clientY - rect.top);

	var x = (xp - g_canvas.width/2) / (g_canvas.width/2);
	var y = (yp - g_canvas.height/2) / (g_canvas.height/2);

	g_xMdragTot += (x - g_xMclik);
	g_yMdragTot += (y - g_yMclik);
  dragQuat(x - g_xMclik, y - g_yMclik);
	g_xMclik = x;
	g_yMclik = y;
}
function myMouseUp(ev, gl, g_canvas) {
	var rect = ev.target.getBoundingClientRect();
	var xp = ev.clientX - rect.left;
	var yp = g_canvas.height - (ev.clientY - rect.top);

	var x = (xp - g_canvas.width/2) / (g_canvas.width/2);
	var y = (yp - g_canvas.height/2) / (g_canvas.height/2);

	g_isDrag = false;
	g_xMdragTot += (x - g_xMclik);
	g_yMdragTot += (y - g_yMclik);
  dragQuat(x - g_xMclik, y - g_yMclik);
}