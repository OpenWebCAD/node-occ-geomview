/* global: THREE,assert */
// GeomView.js

// Author: etienne.rossignon@gadz.org
// released under MIT license 

let assert = assert || function (condition, message) {
      if (!condition) {
          throw new Error(message);
      }
  };

const GeomTools = {

    boundingBox: function (obj) {
        let me = this;
        if (obj instanceof THREE.Mesh) {

            const geometry = obj.geometry;
            geometry.computeBoundingBox();
            return geometry.boundingBox;

        }

        if (obj instanceof THREE.Object3D) {

            const bb = new THREE.Box3();
            for (let i = 0; i < obj.children.length; i++) {
                bb.union(me.boundingBox(obj.children[i]));
            }
            return bb;
        }
    },
    shapeCenterOfGravity: function (obj) {
        const me = this;
        return me.boundingBox(obj).getCenter();
    },

    makeGrid: function () {

        const size = 200, step = 10;
        const geometry = new THREE.Geometry();
        const material = new THREE.LineBasicMaterial({vertexColors: THREE.VertexColors});

        const color1 = new THREE.Color(0x444444), color2 = new THREE.Color(0x888888);

        for (let i = -size; i <= size; i += step) {

            geometry.vertices.push(new THREE.Vector3(-size, i, 0));
            geometry.vertices.push(new THREE.Vector3(size, i, 0));

            geometry.vertices.push(new THREE.Vector3(i, -size, 0));
            geometry.vertices.push(new THREE.Vector3(i, size, 0));

            const color = i === 0 ? color1 : color2;

            geometry.colors.push(color, color, color, color);

        }

        const grid = new THREE.LineSegments(geometry, material);

        return grid;
    },


    setVertices: function (bbox, vertices) {

        vertices[0].x = bbox.max.x;
        vertices[0].y = bbox.max.y;
        vertices[0].z = bbox.max.z;

        vertices[1].x = bbox.max.x;
        vertices[1].y = bbox.max.y;
        vertices[1].z = bbox.min.z;

        vertices[2].x = bbox.max.x;
        vertices[2].y = bbox.min.y;
        vertices[2].z = bbox.max.z;

        vertices[3].x = bbox.max.x;
        vertices[3].y = bbox.min.y;
        vertices[3].z = bbox.min.z;

        vertices[4].x = bbox.min.x;
        vertices[4].y = bbox.max.y;
        vertices[4].z = bbox.min.z;

        vertices[5].x = bbox.min.x;
        vertices[5].y = bbox.max.y;
        vertices[5].z = bbox.max.z;

        vertices[6].x = bbox.min.x;
        vertices[6].y = bbox.min.y;
        vertices[6].z = bbox.min.z;

        vertices[7].x = bbox.min.x;
        vertices[7].y = bbox.min.y;
        vertices[7].z = bbox.max.z;
    }
};


let use_CombinedCamera = false;

function GeomView(container, width, height) {

    width = width || container.offsetWidth;
    height = height || container.offsetHeight;

    const me = this;
    me.container = container;

    me.scene = new THREE.Scene();
    me.sceneHelpers = new THREE.Scene();


    const ratio = width / height;

    if (use_CombinedCamera) {
        me.camera = new THREE.CombinedCamera(width, height, 70, 1, 10000, -500, 1000);
        me.camera.toOrthographic();
    } else {
        me.camera = new THREE.PerspectiveCamera(35, ratio, 1, 100000);

        me.camera.toXXXView = function (dirView, up) {

            const target = me.getObjectCenter();

            // preserve existing distance
            const dist = target.distanceTo(me.camera.position) || 100;

            const eye = new THREE.Vector3(0, 0, 0);
            eye.copy(dirView);
            eye.multiplyScalar(dist); // distance
            eye.addVectors(target, eye);

            console.log("eye", eye);
            console.log("up", up);
            console.log("dirView", dirView);
            me.camera.position.copy(eye);
            me.camera.up.copy(up);

            // look at is a vector
            me.camera.lookAt(dirView);

        };
        me.camera.toTopView = function () {
            this.toXXXView(new THREE.Vector3(0, 0, 1), new THREE.Vector3(0, 1, 0));
        };
        me.camera.toBottomView = function () {
            this.toXXXView(new THREE.Vector3(0, 0, -1), new THREE.Vector3(0, 1, 0));
        };
        me.camera.toFrontView = function () {
            this.toXXXView(new THREE.Vector3(0, -1, 0), new THREE.Vector3(0, 0, 1));
        };
        me.camera.toBackView = function () {
            this.toXXXView(new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 0, 1));
        };
        me.camera.toLeftView = function () {
            this.toXXXView(new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, 0, 1));
        };
        me.camera.toRightView = function () {
            this.toXXXView(new THREE.Vector3(-1, 0, 0), new THREE.Vector3(0, 0, 1));
        };
    }

    me.camera.name = "Camera";
    me.camera.position.z = 100;

    me.renderer = new THREE.WebGLRenderer({alpha: true, antialias: true, clearColor: 0x7F2FFF, clearAlpha: 1});
    me.renderer.setClearColor(new THREE.Color(0x7F2FFF), 0.0);


    me.renderer.autoClear = false;
    me.renderer.clear();

    // make sure canvas can get focus;
    // see http://jsfiddle.net/erossignon/bFraK/3/
    me.renderer.domElement.setAttribute("tabindex", "0");

    container.appendChild(me.renderer.domElement);

    if (use_CombinedCamera) {
        me.controls = new THREE.OrthographicTrackballControls(me.camera, container);
    } else {
        me.controls = new THREE.TrackballControls(me.camera, container);

        me.controls.rotateSpeed = 1.0;
        me.controls.zoomSpeed = 1.2;
        me.controls.panSpeed = 0.8;

        me.controls.noZoom = false;
        me.controls.noPan = false;

        me.controls.staticMoving = true;
        me.controls.dynamicDampingFactor = 0.3;
    }

    me.cameraChanged = false;
    me.controls.addEventListener("change", function () {
        me.cameraChanged = true;
        me.render3D();
    });

    const radius = 1.0;
    me.controls.minDistance = radius * 1.1;
    me.controls.maxDistance = radius * 10000;

    me.controls.keys = [/*A*/65, /*S*/ 83, /*D*/68];


    me.lightContainer = new THREE.Object3D();
    me.lightContainer.matrixWorld = me.camera.matrix;
    me.lightContainer.matrixAutoUpdate = false;

    me.scene.add(me.lightContainer);

    for (let x = -1; x < 2; x = x + 2) {
        for (let y = -1; y < 2; y = y + 2) {
            for (let z = -1; z < 2; z = z + 2) {

                let pointLight = new THREE.PointLight(0xFFFFFF, 0.2);
                pointLight.position.x = 200 * x;
                pointLight.position.y = 200 * y;
                pointLight.position.z = 200 * z;
                pointLight.matrixAutoUpdate = true;

                me.lightContainer.add(pointLight);
                me.lightContainer.add(new THREE.PointLightHelper(pointLight, 1));
            }
        }
    }


    let light = new THREE.AmbientLight(0x222222);
    me.lightContainer.add(light);

    let axis = new THREE.AxisHelper(100);
    // note : changing linewidth seems to have no effect ( bug in threejs ?)
    axis.material.linewidth = 10;
    me.sceneHelpers.add(axis);


    me.intersectionPlane = new THREE.Mesh(new THREE.PlaneBufferGeometry(10000, 10000, 8, 8));
    me.ray = new THREE.Raycaster();
    me.offset = new THREE.Vector3();

    me.grid = GeomTools.makeGrid();
    me.sceneHelpers.add(me.grid);


    me.selectionBox = new THREE.Mesh(
      new THREE.BoxGeometry(1, 1, 1),
      new THREE.MeshBasicMaterial({
          color: 0xffff00,
          wireframe: true,
          fog: false
      }));
    me.selectionBox.matrixAutoUpdate = false;
    me.selectionBox.visible = false;
    me.sceneHelpers.add(me.selectionBox);

    me.selectionAxis = new THREE.AxisHelper(100);
    me.selectionAxis.material.depthTest = false;
    me.selectionAxis.material.transparent = true;
    me.selectionAxis.matrixAutoUpdate = false;
    me.selectionAxis.visible = false;

    me.sceneHelpers.add(me.selectionAxis);


    let private_bgScene;
    let private_bgCam;
    /**
     *
     */
    this.setGraduatedBackgound = function (imageurl) {
        let me = this;
        private_bgScene = null;
        private_bgCam = null;
        // prepare graduated background for the 3D view
        let backgroundTexture = new THREE.TextureLoader().load(
          imageurl,
          function onloadSuccess() {

              let bg = new THREE.Mesh(
                new THREE.PlaneGeometry(2, 2, 0),
                new THREE.MeshBasicMaterial({map: backgroundTexture})
              );

              // The bg plane shouldn't care about the z-buffer.
              bg.material.depthTest = false;
              bg.material.depthWrite = false;

              private_bgScene = new THREE.Scene();
              private_bgCam = new THREE.Camera();
              private_bgScene.add(private_bgCam);

              private_bgScene.add(bg);

              if (me.render3D) {
                  me.render3D();
              }
          },
          undefined,
          function onError() {
              console.log("cannot load background texture");
              if (me.render3D) {
                  me.render3D();
              }
          }
        );
    };


    function renderbackground() {
        me.renderer.clear();
        if (private_bgScene && private_bgCam) {
            me.renderer.render(private_bgScene, private_bgCam);
        }
    }


    me.render3D = function () {

        const me = this;
        renderbackground();

        me.sceneHelpers.updateMatrixWorld();
        me.scene.updateMatrixWorld();

        me.renderer.render(me.sceneHelpers, me.camera);
        me.renderer.render(me.scene, me.camera);

    };

    me.setGraduatedBackgound("/images/backgrounds/Graduated_Blue_Background.png");

    me.resizeRenderer = function () {
        const me = this;

        const width = me.container.offsetParent.offsetWidth;
        const height = me.container.offsetParent.offsetHeight;

        //xx const width = me.container.offsetWidth + me.container.offsetLeft;
        //xx const height = me.container.offsetHeight  + me.container.offsetTop;

        me.renderer.setSize(width, height);

        if (me.camera.setSize) {
            // combined ?
            me.camera.setSize(width, height);
        }
        me.camera.aspect = width / height;
        me.camera.updateProjectionMatrix();
        me.render3D();
    };
    me.resizeRenderer();


    function MyAnimate() {
        "use strict";
        requestAnimationFrame(MyAnimate);
        me.controls.update();
    }

    MyAnimate();

    me.render3D();

    function getOffsetLeft(element) {
        let offsetLeft = 0;
        do {
            if (!isNaN(element.offsetLeft)) {
                offsetLeft += element.offsetLeft;
            }
        } while (null !== ( element = element.offsetParent ));
        return offsetLeft;
    }

    function getOffsetTop(element) {
        let offsetTop = 0;
        do {
            if (!isNaN(element.offsetTop)) {
                offsetTop += element.offsetTop;
            }
        } while (null !== ( element = element.offsetParent ));
        return offsetTop;
    }

    /**
     * converts mouse event into frustumCoordinate
     */
    function frustumCoord(event) {

        let el = event.currentTarget; // me.renderer.domElement;
        let dx = getOffsetLeft(el);
        let dy = getOffsetTop(el);

        let vector = new THREE.Vector3(
          ( ( event.clientX - dx ) / el.offsetWidth ) * 2 - 1,
          -( ( event.clientY - dy ) / el.offsetHeight ) * 2 + 1,
          me.camera.near
        );
        console.log(" click at :" + event.clientX + " " + event.clientY + " ", vector, " dx= ", dx, " dy=", dy);
        return vector;
    }

    function buildIntersectPlane(event) {

        let vector = frustumCoord(event);
        vector.unproject(me.camera);

        me.ray.set(me.camera.position, vector.sub(me.camera.position).normalize());
        return me.ray.intersectObject(me.intersectionPlane);
    }

    function buildIntersectScene(event) {

        let vector = frustumCoord(event);
        vector.unproject(me.camera);
        me.ray.set(me.camera.position, vector.sub(me.camera.position).normalize());
        let results = me.ray.intersectObjects([me.scene], true);
        results = results.filter(function (o) {
            return findSelectedObject(o.object).visible;
        });
        return results;


    }

    let SelectObjectManipulator = function () {

    };

    SelectObjectManipulator.prototype.onMoveDown = function (event) {
        /*
         console.log(" onMouseDown ",event);

         var picked ;

         event.preventDefault();

         if ( event.button === 0 ) {

         var intersects =buildIntersectScene(event);

         if ( intersects.length > 0 ) {

         picked = findSelectedObject(intersects[ 0 ].object);
         }

         if ( picked ) {

         me.controls.enabled = false;


         function startDraging(root,point) {

         me.intersectionPlane.position.copy( root.position );

         me.intersectionPlane.lookAt( me.camera.position );

         var intersects = me.ray.intersectObject( me.intersectionPlane );

         me.offset.copy(point  ).sub( me.intersectionPlane.position );

         document.addEventListener( "mousemove", onMouseMove, false );
         document.addEventListener( "mouseup", onMouseUp, false );
         }

         startDraging(picked, intersects[ 0 ].point);


         } else {
         me.controls.enabled = true;
         }

         me.cameraChanged = false;
         */

    };

    SelectObjectManipulator.prototype.onClick = function (event) {

        console.log(" onClick ", event);
        let objects = [me.scene];

        if (event.button === 0) {

            let intersects = buildIntersectScene(event);

            let picked = null;
            if (intersects.length > 0) {
                picked = findSelectedObject(intersects[0].object);
            }

            if (picked && picked.properties) {
                console.log(" clicked on ", picked.properties.OCCType, " name = ", picked.properties.OCCName);
            }

            me.selectObject(picked);
            event.preventDefault();

        }

        me.controls.enabled = true;

    };

    let DragObjectManipulator = function () {

    };
    DragObjectManipulator.prototype.onMouseMove = function (event) {

        const intersects = buildIntersectPlane(event);

        if (intersects.length > 0) {

            intersects[0].point.sub(me.offset);

            if (me.selected) {
                // move the selection on the screen
                me.selected.position.copy(intersects[0].point);
            }
            me.render3D();
        }
    };

    me.manipulator = new SelectObjectManipulator();

    const onMouseMove = function onMouseMove(event) {
        if (me.manipulator && me.manipulator.onMouseMove) {
            me.manipulator.onMouseMove(event);
            event.preventDefault();
        }
    };

    const onMouseDown = function onMouseDown(event) {

        if (me.manipulator && me.manipulator.onMoveDown) {
            me.manipulator.onMoveDown(event);
            event.preventDefault();
        }
    };


    const onMouseUp = function onMouseUp(event) {
        if (me.manipulator && me.manipulator.onMouseUp) {
            me.manipulator.onMouseUp(event);
            event.preventDefault();
        }
    };

    const onClick = function onClick(event) {
        if (me.manipulator && me.manipulator.onClick) {
            me.manipulator.onClick(event);
            event.preventDefault();
        }
    };

    function findSelectedObject(pickedObject) {
        let parent = pickedObject.parent;
        while (parent && parent.properties && parent.properties.OCCType !== "Solid") {
            parent = parent.parent;
        }
        return parent;
    }

    me.renderer.domElement.addEventListener("mousemove", onMouseMove, false);
    me.renderer.domElement.addEventListener("mouseup", onMouseUp, false);
    me.renderer.domElement.addEventListener("mousedown", onMouseDown, false);
    me.renderer.domElement.addEventListener("click", onClick, false);
}


GeomView.prototype.__solidObjectsNode = function (json) {
    const me = this;
    let rootNode = me.scene.getObjectByName("SOLIDS");
    if (!rootNode) {
        rootNode = new THREE.Object3D();
        rootNode.name = "SOLIDS";
        me.scene.add(rootNode);
    }
    return rootNode;
};


GeomView.prototype.selectObject = function (object) {

    const me = this;

    assert(typeof me.selectionBox === "object");

    if (object === me.selected) {
        return;
    }

    if (object !== null) {

        me.selected = object;

        const hasRotation = true;

        const bbox = GeomTools.boundingBox(object);

        const vertices = me.selectionBox.geometry.vertices;
        GeomTools.setVertices(bbox, vertices);

        me.selectionBox.geometry.computeBoundingSphere();
        me.selectionBox.geometry.verticesNeedUpdate = true;

        me.selectionBox.matrixWorld = object.matrixWorld;
        me.selectionAxis.matrixWorld = object.matrixWorld;
        me.selectionBox.visible = true;


    } else {
        me.selectionBox.visible = false;
        me.selected = null;
    }

    // me.emit("selectObject",me.selected);

    me.render3D();
};


GeomView.prototype.getDefaultColor = function () {

    const color = [Math.random(), Math.random(), Math.random()];
//   var color = [ 249.0/ 255.0, 195.0/ 255.0, 61.0/ 255.0];
    return color;
};

GeomView.prototype.highlightObject = function (obj3D) {
    // TODO:
    // me.selection =
};


GeomView.prototype.getSolidByName = function (objName) {
    const me = this;
    const rootNode = me.__solidObjectsNode();
    return rootNode.getObjectByName(objName);
};
/*
 *  json = { solids: [ id: "ID" , { faces: [], edges: [] }, ...]}
 *
 *
 */
GeomView.prototype.updateShapeObject = function (json) {

    const me = this;

    /**
     *  Convert a rgb color to hex,
     *  each Red Green Blue component of RGB shall be in the range [0,1]
     *
     */
    function rgb2hex(rgb) {
        /* jshint ignore bitwise */
        return ( rgb[0] * 255 << 16 ) + ( rgb[1] * 255 << 8 ) + rgb[2] * 255;
    }

    function process_face_mesh(rootNode, jsonEntry, color) {

        const jsonFace = jsonEntry.mesh;

        jsonFace.scale = 1.0;
        const jsonLoader = new THREE.JSONLoader();

        const model = jsonLoader.parse(jsonFace, /* texturePath */ undefined);

        const material = new THREE.MeshLambertMaterial({color: rgb2hex(color)});
        const mesh = new THREE.Mesh(model.geometry, material);
        mesh.properties = mesh.properties || {};
        mesh.properties.OCCType = "face";
        mesh.properties.OCCName = jsonFace.name;
        rootNode.add(mesh);
    }

    function process_edge_mesh(rootNode, jsonEdge) {
        const v = jsonEdge.mesh;
        const geometry = new THREE.Geometry();
        let i = 0;
        while (i < v.length) {
            geometry.vertices.push(new THREE.Vector3(v[i], v[i + 1], v[i + 2]));
            i += 3;
        }
        const material = new THREE.LineDashedMaterial({linewidth: 4, color: 0xffffff});
        const polyline = new THREE.Line(geometry, material);
        polyline.properties = polyline.properties || {};
        polyline.properties.OCCType = "edge";
        polyline.properties.OCCName = jsonEdge.name;
        rootNode.add(polyline);
    }


    const rootNode = me.__solidObjectsNode();

    let node = rootNode;
    if (json.name) {
        const oldObj = rootNode.getObjectByName(json.name);
        if (oldObj) {
            rootNode.remove(oldObj);
        }
        node = new THREE.Object3D();
        node.name = json.name;
        rootNode.add(node);
    }

    // read solids
    const jsonSolids = json.solids;

    jsonSolids.forEach(function (solidMesh) {

        const color = [Math.random(), Math.random(), Math.random()];

        const group = new THREE.Object3D();
        node.add(group);
        group.name = solidMesh.name;
        group.properties = group.properties || {};
        group.properties.OCCType = "Solid";
        group.properties.OCCName = solidMesh.name;
        group.properties.OCCID = solidMesh.id;
        group.properties.OCCColor = color.slice(0);

        // one object
        solidMesh.faces.forEach(function (face) {
            // one face
            process_face_mesh(group, face, color);
        });
        solidMesh.edges.forEach(function (edge) {
            // one face
            process_edge_mesh(group, edge);
        });
    });
};


/**
 * remove all objects from the graphical view
 */
GeomView.prototype.clearAll = function () {
    const me = this;
    const rootNode = me.__solidObjectsNode();
    if (rootNode) {
        me.scene.remove(rootNode);
    }
};


/**
 * point the current camera to the center
 * of the graphical object (zoom factor is not affected)
 *
 * the camera is moved in its  x,z plane so that the orientation
 * is not affected either
 */
GeomView.prototype.pointCameraTo = function (node) {
    const me = this;

    // Refocus camera to the center of the new object
    let COG;
    if (node instanceof THREE.Vector3) {
        COG = node;
    } else {
        // Refocus camera to the center of the new object
        COG = GeomTools.shapeCenterOfGravity(node);
    }
    const v = new THREE.Vector3();
    v.subVectors(COG, me.controls.target);
    me.camera.position.addVectors(me.camera.position, v);

    // retrieve camera orientation

    me.controls.target.set(COG.x, COG.y, COG.z);
    me.camera.lookAt(COG);
    me.camera.updateProjectionMatrix();

    me.render3D();
};

/**
 * Zoom All
 */
GeomView.prototype.zoomAll = function () {

    const me = this;

    let node = me.selected;

    if (!node) {
        node = me.__solidObjectsNode();
    }

    me.zoomObject(node);
};


GeomView.prototype.showGrid = function (flag) {
    const me = this;
    if (me.grid.visible !== flag) {

        me.grid.visible = flag;
        me.render3D();
    }
};

GeomView.prototype.getObjectBox = function (node) {
    const me = this;
    if (!node) {
        node = me.__solidObjectsNode();
    }
    const bbox = GeomTools.boundingBox(node);
    return bbox;
};

GeomView.prototype.getObjectCenter = function (node) {
    const me = this;
    const bbox = me.getObjectBox(node);
    if (bbox.isEmpty()) {
        return new THREE.Vector3(0, 0, 0);
    }
    const COG = bbox.getCenter();
    return COG;
};


/**
 * Zoom on Object
 */
GeomView.prototype.zoomObject = function (node) {

    const me = this;

    const bbox = me.getObjectBox(node);
    if (bbox.isEmpty()) {
        return;
    }
    const COG = bbox.getCenter();

    me.pointCameraTo(COG);

    const sphereSize = bbox.getSize().length() * 0.5;
    const distToCenter = sphereSize / Math.sin(Math.PI / 180.0 * me.camera.fov * 0.5);
    // move the camera backward
    const target = me.controls.target;
    const vec = new THREE.Vector3();
    vec.subVectors(me.camera.position, target);
    vec.setLength(distToCenter);
    me.camera.position.addVectors(vec, target);
    me.camera.updateProjectionMatrix();
    me.render3D();
};

/**
 * Zoom on Object
 */
GeomView.prototype.onChangeView = function (viewName) {

    const me = this;
    switch (viewName.toUpperCase()) {
        case "Z+":
        case "TOP":
            me.camera.toTopView();
            break;
        case "Z-":
        case "BOTTOM":
            me.camera.toBottomView();
            break;
        case "RIGHT":
            me.camera.toRightView();
            break;
        case "LEFT":
            me.camera.toLeftView();
            break;
        case "FRONT":
            me.camera.toFrontView();
            break;
        case "BACK":
            me.camera.toBackView();
            break;
    }
    me.camera.updateProjectionMatrix();
    me.resizeRenderer();
    me.render3D();
};


exports.GeomView = GeomView;
exports.GeomTools = GeomTools;
