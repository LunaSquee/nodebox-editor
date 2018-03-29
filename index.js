(function () {
  Math.fmod = function (a,b) { return Number((a - (Math.floor(a / b) * b)).toPrecision(8)); };
  Math.radians = function(degrees) { return degrees * Math.PI / 180; };

  var sidebarWidth = 400;
  var resolution = 16;
  var Camera = {
    sensitivity: 0.3,
    cameraMoveDown: false,
    yaw: -135,
    zoom: 5,
    pitch: -25,
    origin: new THREE.Vector3(0.5, 0, 0.5)
  }

  var width = window.innerWidth - sidebarWidth;
  var height = window.innerHeight;

  var scene = new THREE.Scene();
  var camera = new THREE.PerspectiveCamera( 75, width / height, 0.1, 1000 );

  var renderer = new THREE.WebGLRenderer();

  renderer.setSize( width, height );
  document.getElementById('main').appendChild( renderer.domElement );

  scene.background = new THREE.Color(0x99cdff);

  var grid = new THREE.GridHelper(50, 50);
  scene.add(grid);

  var axes = new THREE.AxesHelper( 5 );
  scene.add( axes );

  function exportCubes () {
    let res = []
    for (let c in Cubes) {
      let cube = Cubes[c];
      let pos = []

      pos.push(cube.position.x - 0.5);
      pos.push(cube.position.y - 0.5);
      pos.push(cube.position.z - 0.5);

      pos.push(cube.position.x + cube.extents.x - 0.5);
      pos.push(cube.position.y + cube.extents.y - 0.5);
      pos.push(cube.position.z + cube.extents.z - 0.5);

      res.push(pos);
    }

    let str = 'node_box = {\n';
    str += '\ttype = "fixed",\n';
    str += '\tfixed = {\n';

    for (let i in res) {
      str += '\t\t{';
      let ps = [];
      for (let j in res[i]) {
        let p = res[i][j];
        ps.push(p.toPrecision(4));
      }
      str += ps.join(', ');
      str += '}';

      if (i != res.length - 1) {
        str += ',';
      }

      str += '\n';
    }

    str += '\t}\n';
    str += '}';

    return str;
  }

  var DOM = {
    cubes: document.getElementById('cubes'),
    tiles: document.getElementById('tiles'),
    sideTranslation: ['right', 'left', 'top', 'bottom', 'front', 'back'],
    tileList: {},
    inputsPresent: {},

    // Texturing
    setFileSide: function (side, result) {
      let match = result.match(/data:image\/(\w+);/);


      if (!match) {
        return alert('Not an image file!');
      }

      if (match[1] !== 'png' && match[1] !== 'jpg' && match[1] !== 'jpeg') {
        return alert('Unsupported image file');
      }

      let tex = new THREE.TextureLoader().load(result);
      let color = new THREE.Color({r: 0, g: 0, b: 0});

      tex.magFilter = THREE.NearestFilter;
      tex.minFilter = THREE.LinearMipMapLinearFilter;

      if (side == 'all') {
        for (let sideIndex in DOM.sideTranslation) {
          DOM.sideMaterials[sideIndex].map = tex;
          DOM.sideMaterials[sideIndex].color = color;
          DOM.sideMaterials[sideIndex].needsUpdate = true;
        }
      } else {
        let sideIndex = DOM.sideTranslation.indexOf(side);
        DOM.sideMaterials[sideIndex].map = tex;
        DOM.sideMaterials[sideIndex].color = color;
        DOM.sideMaterials[sideIndex].needsUpdate = true;
      }
    },
    handleFileSide: function (e, elem, side) {
      let file = elem.files[0];
      
      if (!window.File || !window.FileReader || !window.FileList || !window.Blob) {
        return alert('The File APIs are not fully supported in this browser.')
      }

      let fr = new FileReader();
      fr.readAsDataURL(file);
      fr.addEventListener('load', function (e) {
        DOM.setFileSide(side, fr.result);
      })
    },
    fileInputFor: function (e, node, side) {
      if (DOM.inputsPresent[side]) return;
      let fileSelect = document.createElement('input');
      
      fileSelect.setAttribute('type', 'file');
      node.appendChild(fileSelect);

      DOM.inputsPresent[side] = true;

      fileSelect.addEventListener('change', function (e) {
        DOM.handleFileSide(e, fileSelect, side)
      }, false)
    },

    // Tile list
    buildTileList: function () {
      for (let n in DOM.tiles.childNodes) {
        let node = DOM.tiles.childNodes[n];
        if (!(node instanceof Element)) continue;
        DOM.tileList[node.id] = { texture: null, elem: node };
        DOM.inputsPresent[node.id] = false;

        node.addEventListener('click', function (e) {
          DOM.fileInputFor(e, node, node.id)
        }, false)
      }

      DOM.getTileColors();
    },
    getTileColors: function () {
      let materials = [];
      for (let side in DOM.tileList) {
        if (side == 'all') continue;
        let color = 0x000000;
        switch (side) {
          case "top":
            color = 0x00ff00;
            break;
          case "right":
            color = 0xff0000;
            break;
          case "front":
            color = 0x0000ff;
            break;
          case "bottom":
            color = 0xff00ff;
            break;
          case "left":
            color = 0x00ffff;
            break;
          case "back":
            color = 0xffff00;
            break;
        }

        DOM.tileList[side].color = color;
      }

      for (let i = 0; i < 6; i++) {
        let name = DOM.sideTranslation[i];
        let color = DOM.tileList[name].color;

        let mat = new THREE.MeshBasicMaterial( { color } );
        materials.push(mat);

        DOM.tileList[name].material = mat;
      }

      DOM.sideMaterials = materials;
    },

    // Cube list
    cubeDesignationSimple: function (data) {
      let str = '(';
      str += data.position.x + ', ' + data.position.y + ', ' + data.position.z;
      str += '; ';
      str += data.extents.x + ', ' + data.extents.y + ', ' + data.extents.z;
      str += ')'
      return str;
    },
    createField: function(coordinate, instance, type) {
      let fieldContainer = document.createElement('div');
      fieldContainer.setAttribute('class', 'field');

      let label = document.createElement('label');
      label.innerHTML = coordinate.toUpperCase();
      fieldContainer.appendChild(label);

      let input = document.createElement('input');
      input.setAttribute('type', 'number');
      input.setAttribute('step', '1');
      input.setAttribute('max', resolution.toString());
      input.setAttribute('min', '0');
      fieldContainer.appendChild(input);

      let field = instance.position;
      if (type == 1) {
        field = instance.extents;
      }

      input.addEventListener('change', function (e) {
        e.preventDefault();
        let saneValue = parseFloat(input.value);
        
        if (isNaN(saneValue)) {
          saneValue = field[coordinate] * resolution;
          input.value = saneValue;
        }

        if (type == 0) {
          instance.position[coordinate] = saneValue / resolution;
        } else {
          instance.extents[coordinate] = saneValue / resolution;
        }

        instance.changed = true;
      });

      input.value = field[coordinate] * resolution;

      return fieldContainer;
    },
    createFieldset: function (label) {
      let fieldset = document.createElement('div');
      fieldset.setAttribute('class', 'fieldset');

      let l = document.createElement('span');
      l.innerHTML = label;
      fieldset.appendChild(l);

      return fieldset;
    },
    addFields: function (cube, parent) {
      let fs = DOM.createFieldset('Position');
      fs.appendChild(DOM.createField('x', cube, 0))
      fs.appendChild(DOM.createField('y', cube, 0))
      fs.appendChild(DOM.createField('z', cube, 0))

      let fs2 = DOM.createFieldset('Scale');
      fs2.appendChild(DOM.createField('x', cube, 1))
      fs2.appendChild(DOM.createField('y', cube, 1))
      fs2.appendChild(DOM.createField('z', cube, 1))

      parent.appendChild(fs);
      parent.appendChild(fs2);
    },
    renderCubeConfigurator: function (cube, btn) {
      let expnd = btn.querySelector('#expand')
      let cubeCfgr = btn.querySelector('#configurator')

      if (cubeCfgr) {
        cubeCfgr.parentNode.removeChild(cubeCfgr);
        expnd.innerHTML = '+';
        cube.autoexpand = false;
        return
      }

      cubeCfgr = document.createElement('div');
      cubeCfgr.setAttribute('id', 'configurator');
      cubeCfgr.setAttribute('class', 'cfg_bar');

      DOM.addFields(cube, cubeCfgr);

      btn.appendChild(cubeCfgr);
      expnd.innerHTML = '-';

      cube.autoexpand = true;
    },
    redrawCubeList: function () {
      DOM.cubes.innerHTML = '';

      for (let i in Cubes) {
        let cube = Cubes[i]
        let cubeData = document.createElement('div');
        cubeData.setAttribute('class', 'list_entry');

        let expand = document.createElement('span');
        expand.setAttribute('id', 'expand');
        expand.innerHTML = '+';
        cubeData.appendChild(expand);

        let cubeName = document.createElement('span');
        cubeName.setAttribute('class', 'designation');
        cubeName.innerHTML = DOM.cubeDesignationSimple(cube);
        cubeData.appendChild(cubeName);

        let remove = document.createElement('span');
        remove.setAttribute('class', 'remove');
        remove.innerHTML = 'Remove';
        remove.addEventListener('click', function (e) {
          scene.remove(cube.mesh);
          cube.garbage = true;
        }, false);
        cubeData.appendChild(remove);

        expand.addEventListener('click', function (e) {
          DOM.renderCubeConfigurator(cube, cubeData);
        }, false);

        if (cube.autoexpand) {
          DOM.renderCubeConfigurator(cube, cubeData);
        }

        DOM.cubes.appendChild(cubeData);
      }
    }
  };

  var cubeGeometry = new THREE.BoxGeometry( 1, 1, 1 );

  var Cubes = [{
    geometry: cubeGeometry,
    material: null,
    mesh: null,
    position: new THREE.Vector3(0, 0, 0),
    extents: new THREE.Vector3(1, 1, 1),
    changed: true
  }]

  var renderTick = function () {
    requestAnimationFrame( renderTick );
    let skip = [];
    let garbageFound = false;

    for (let c in Cubes) {
      let cube = Cubes[c];

      if (cube.garbage) {
        garbageFound = true;
        continue;
      } else {
        skip.push(cube);
      }

      if (!cube.changed) continue;

      cube.mesh.scale.x = cube.extents.x;
      cube.mesh.scale.y = cube.extents.y;
      cube.mesh.scale.z = cube.extents.z;

      cube.mesh.position.x = (cube.position.x + cube.extents.x / 2);
      cube.mesh.position.y = (cube.position.y + cube.extents.y / 2);
      cube.mesh.position.z = (cube.position.z + cube.extents.z / 2);

      cube.changed = false;
    }

    if (garbageFound) {
      Cubes = skip;
      DOM.redrawCubeList();
    }

    renderer.render(scene, camera);
  };

  function pointerOnCanvas (e) {
    let x
    let y

    if (e.changedTouches) {
      let touch = e.changedTouches[0]
      if (touch) {
        e.pageX = touch.pageX
        e.pageY = touch.pageY
      }
    }

    if (e.pageX || e.pageY) { 
      x = e.pageX
      y = e.pageY
    } else {
      x = e.clientX + document.body.scrollLeft + document.documentElement.scrollLeft
      y = e.clientY + document.body.scrollTop + document.documentElement.scrollTop
    }

    x -= renderer.domElement.offsetLeft
    y -= renderer.domElement.offsetTop

    return {x: x, y: y}
  }

  renderer.domElement.addEventListener('mousedown', function (e) {
    e.preventDefault()
    e = e || window.event;
    if (e.which == 2) {
      Camera.cameraMoveDown = true
    }
  }, false)

  renderer.domElement.addEventListener('mouseup', function (e) {
    e.preventDefault()
    e = e || window.event;
    if (e.which == 2) {
      Camera.cameraMoveDown = false
    }
  }, false)

  function cameraRecalc() {
    var hdist = Camera.zoom * Math.cos(Math.radians(Camera.pitch))
    var vdist = Camera.zoom * Math.sin(Math.radians(Camera.pitch))
    
    let y = Camera.origin.y - vdist
    let x = Camera.origin.x - hdist * Math.sin(Math.radians(Camera.yaw))
    let z = Camera.origin.z - hdist * Math.cos(Math.radians(Camera.yaw))
        
    camera.position.set(x, y, z)
    camera.lookAt(Camera.origin)
  }

  var lastMouse = {x: 0, y: 0}

  renderer.domElement.addEventListener('mousemove', function (e) {
    let pos = pointerOnCanvas(e)
    // Handle
    if (Camera.cameraMoveDown) {
      // Move camera
      let deltaPos = {x: pos.x - lastMouse.x, y: pos.y - lastMouse.y}
      Camera.yaw = Math.fmod(Camera.yaw - deltaPos.x * Camera.sensitivity, 360)
      Camera.pitch = Math.max(Math.min(Camera.pitch - deltaPos.y * Camera.sensitivity, 90), -90)

      cameraRecalc()
    }

    // Set last pos
    lastMouse = pos
  }, false)

  renderer.domElement.addEventListener('contextmenu', function (e) {
    e.preventDefault()
  }, false)

  function mousewheel (e) {
    e.preventDefault();
    e.stopPropagation();
    switch ( e.deltaMode ) {
      case 2:
        // Zoom in pages
        Camera.zoom += e.deltaY * 0.025;
        break;
      case 1:
        // Zoom in lines
        Camera.zoom += e.deltaY * 0.05;
        break;
      default:
        // undefined, 0, assume pixels
        Camera.zoom += e.deltaY * 0.00025;
        break;
    }

    Camera.zoom = Math.max(Math.min(Camera.zoom, 20), 1)

    cameraRecalc()
    return false
  }

  renderer.domElement.addEventListener('wheel', mousewheel, false);

  DOM.buildTileList();

  Cubes[0].mesh = new THREE.Mesh( Cubes[0].geometry, DOM.sideMaterials );
  scene.add(Cubes[0].mesh);

  cameraRecalc();

  DOM.redrawCubeList();

  document.getElementById('new_cube').addEventListener('click', function (e) {
    let c = {
      geometry: cubeGeometry,
      material: null,
      mesh: new THREE.Mesh( cubeGeometry, DOM.sideMaterials ),
      position: new THREE.Vector3(0, 0, 0),
      extents: new THREE.Vector3(1, 1, 1),
      changed: true
    }

    scene.add(c.mesh);
    Cubes.push(c);

    DOM.redrawCubeList();
  }, false);

  document.getElementById('export').addEventListener('click', function (e) {
    document.getElementById('exported').innerHTML = exportCubes();
  }, false);

  window.onbeforeunload = function () {
    return "Are you sure that you want to leave this page?";
  }

  renderTick();
})()
