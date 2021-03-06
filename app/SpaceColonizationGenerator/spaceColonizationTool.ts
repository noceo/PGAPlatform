import {
  AmbientLight,
  Color,
  DirectionalLight,
  FogExp2,
  HemisphereLight,
  Light,
  Material,
  Mesh,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  PCFSoftShadowMap,
  PerspectiveCamera,
  PlaneGeometry,
  PointLight,
  PointLightHelper,
  Scene,
  Shader,
  ShaderChunk,
  ShaderMaterial,
  WebGLRenderer,
} from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls'
import Stats from 'stats.js'
import { TreeGenerator } from './treeGenerator'
import { mapParam } from './helpers'
import { treeColorShader } from './shaders'
import VisualizationTool from '~/model/visualizationTool/visualizationTool'
import paramConfig from '~/model/visualizationTool/parameterConfig/parameter.config'
import { IParameterConfig } from '~/model/visualizationTool/parameterConfig/parameter.types'
import { generateID } from '~/model/helpers/idGenerator'
import {
  IStoreLiveParams,
  IStoreVizParams,
} from '~/store/modules/global/state/state.types'
import { IVizParameter } from '~/model/IVizParameter'
import { ITextDataParameter } from '~/model/ITextDataParameter'
import { ILiveVizParameter } from '~/model/ILiveVizParameter'

export class SpaceColonizationTool extends VisualizationTool {
  protected _availableParameters: IStoreVizParams
  protected _availableLiveParameters: IStoreLiveParams

  private _scene: Scene
  private _camera: PerspectiveCamera
  private _renderer: WebGLRenderer
  private _stats: Stats
  private _treeGenerator: TreeGenerator
  private _treeDebugMaterial: Material
  private _lights: Array<Light> = []
  private _controls: OrbitControls
  private _fogShaders: Array<Shader>
  private _treeColorShaders: Array<Shader>
  private _previousRAF: number | null
  private _totalTime: number
  private _windEnabled: boolean
  private _windIntensity: number

  constructor(canvas: HTMLCanvasElement, debugMode: boolean) {
    super(canvas, debugMode)
    this._availableParameters = this.createParams(paramConfig)
    this._availableLiveParameters = this.createLiveParams(paramConfig)

    this._scene = new Scene()
    this._camera = new PerspectiveCamera(
      75,
      window.innerWidth / window.innerHeight,
      0.1,
      20000
    )
    this._renderer = new WebGLRenderer({
      canvas: this._canvas,
      antialias: true,
      preserveDrawingBuffer: true,
    })
    this._renderer.setSize(window.innerWidth, window.innerHeight)
    this._renderer.setPixelRatio(window.devicePixelRatio)
    this._renderer.shadowMap.enabled = true
    this._renderer.shadowMap.type = PCFSoftShadowMap
    // eslint-disable-next-line unicorn/number-literal-case
    this._scene.background = new Color(0x000000)

    this._fogShaders = []
    const modifyShaderWithFog = (s: Shader) => {
      this._fogShaders.push(s)
      s.uniforms.windEnabled = { value: true }
      s.uniforms.fogTime = { value: 0.0 }
      s.uniforms.windIntensity = { value: 0.0 }
    }

    // create TREES
    this._treeGenerator = new TreeGenerator(this._scene, 200)
    this._treeColorShaders = []
    this._treeDebugMaterial = new ShaderMaterial({
      uniforms: treeColorShader.uniforms,
      vertexShader: treeColorShader.vertexShader,
      fragmentShader: treeColorShader.fragmentShader,
      wireframe: true,
    })
    for (let i = 0; i < 3; i++) {
      const treeMaterial = new MeshStandardMaterial()
      treeMaterial.onBeforeCompile = (s: Shader) => {
        s.uniforms.gradientFactor = { value: 0 }
        s.uniforms.colorLow = { value: new Color(0, 1, 0) }
        s.uniforms.colorMid = { value: new Color(1, 0.5, 0) }
        s.uniforms.colorHigh = { value: new Color(1, 0, 0) }

        s.fragmentShader = `
          uniform float gradientFactor;
          uniform vec3 colorLow;
          uniform vec3 colorMid;
          uniform vec3 colorHigh;
          ${s.fragmentShader}
        `.replace(
          `vec4 diffuseColor = vec4( diffuse, opacity );`,
          `
            vec3 color;
            float percentage;
            if (gradientFactor <= 0.5) {
              percentage = gradientFactor / 0.5;
              color = mix(colorLow, colorMid, percentage);
            } else {
              percentage = (gradientFactor - 0.5) / 0.5;
              color = mix(colorMid, colorHigh, percentage);
            }
            vec4 diffuseColor = vec4(color, opacity);
          `
        )
        this._treeColorShaders.push(s)
        modifyShaderWithFog(s)
      }
      this._treeGenerator.updateTreeAtIndex(
        i,
        0,
        treeMaterial,
        this._treeDebugMaterial
      )
    }

    const treeGroupMiddleX = this._treeGenerator.computeMiddleX()
    this._camera.position.set(treeGroupMiddleX, 100, 250)

    // const sky = new Mesh(
    //   new SphereGeometry(500, 32, 32),
    //   new MeshBasicMaterial({
    //     // eslint-disable-next-line unicorn/number-literal-case
    //     color: 0x000000,
    //     side: BackSide,
    //   })
    // )
    // sky.position.setX(treeGroupMiddleX)
    // ;(sky.material as Material).onBeforeCompile = _modifyShader
    // this._scene.add(sky)

    const ground = new Mesh(
      new PlaneGeometry(3000, 3000),
      new MeshPhysicalMaterial({
        // eslint-disable-next-line unicorn/number-literal-case
        color: 0x000000,
      })
    )
    ground.rotation.x = -Math.PI / 2
    ground.position.setX(treeGroupMiddleX)
    ;(ground.material as Material).onBeforeCompile = modifyShaderWithFog
    this._scene.add(ground)

    // const hill = new Mesh(
    //   new SphereGeometry(40, 20, 20),
    //   new MeshBasicMaterial({
    //     // eslint-disable-next-line unicorn/number-literal-case
    //     color: 0xa9a9a9,
    //   })
    // )
    // hill.position.y -= 30
    // this._scene.add(hill)

    // CREATE LIGHTS
    // eslint-disable-next-line unicorn/number-literal-case
    const ambientLight = new AmbientLight(0x101010)
    this._scene.add(ambientLight)

    // eslint-disable-next-line unicorn/number-literal-case
    const dirLight = new DirectionalLight(0xffffff, 1.0)
    dirLight.position.set(20, 100, 10)
    dirLight.target.position.set(0, 0, 0)
    dirLight.castShadow = true
    dirLight.shadow.bias = -0.001
    dirLight.shadow.mapSize.width = 2048
    dirLight.shadow.mapSize.height = 2048
    dirLight.shadow.camera.near = 0.1
    dirLight.shadow.camera.far = 500.0
    dirLight.shadow.camera.near = 0.5
    dirLight.shadow.camera.far = 500.0
    dirLight.shadow.camera.left = 100
    dirLight.shadow.camera.right = -100
    dirLight.shadow.camera.top = 100
    dirLight.shadow.camera.bottom = -100
    this._scene.add(dirLight)

    // eslint-disable-next-line unicorn/number-literal-case
    const hemiLight = new HemisphereLight(0xe5e5e5, 0xffffff, 0.05)
    this._scene.add(hemiLight)

    // CREATE FOG
    // eslint-disable-next-line unicorn/number-literal-case
    this._scene.fog = new FogExp2(0xdfe9f3, 0.001)

    window.addEventListener('resize', () => {
      this._renderer.setSize(window.innerWidth, window.innerHeight)
      this._camera.aspect = window.innerWidth / window.innerHeight
      this._camera.updateProjectionMatrix()
    })

    // CREATE CONTROLS
    this._controls = new OrbitControls(this._camera, this._canvas)
    this._controls.enableDamping = true
    this._controls.dampingFactor = 0.1
    this._controls.zoomSpeed = 1
    this._controls.enablePan = false
    this._controls.minDistance = 1
    this._controls.target.set(treeGroupMiddleX, 100, 0)
    this._controls.enablePan = true

    this._stats = new Stats()
    this._stats.showPanel(0) // 0: fps, 1: ms, 2: mb, 3+: custom
    document.body.appendChild(this._stats.dom)

    this.setup()
    this.initFogShader()
    this._windEnabled = true
    this._windIntensity = 1
    this._totalTime = 0
    this._previousRAF = null
    this.RAF()
  }

  getAvailableParameters(): IStoreVizParams {
    return this._availableParameters
  }

  getAvailableLiveParameters(): IStoreLiveParams {
    return this._availableLiveParameters
  }

  onNewData(data: {
    vizParams: Array<IVizParameter>
    textParams: Array<ITextDataParameter>
  }): void {
    for (const vizParam of data.vizParams) {
      const treeColorValue = 1 - vizParam.value
      if (vizParam.name === 'no2') {
        this._treeGenerator.updateTreeAtIndex(0, vizParam.value)
        this._treeColorShaders[0].uniforms.gradientFactor.value = treeColorValue
      }
      if (vizParam.name === 'co') {
        this._treeGenerator.updateTreeAtIndex(1, vizParam.value)
        this._treeColorShaders[1].uniforms.gradientFactor.value = treeColorValue
      }
      if (vizParam.name === 'pm10') {
        this._treeGenerator.updateTreeAtIndex(2, vizParam.value)
        this._treeColorShaders[2].uniforms.gradientFactor.value = treeColorValue
      }
    }
  }

  onNewLiveParams(data: Array<ILiveVizParameter>): void {
    for (const param of data) {
      if (param.name === 'windForce') {
        this._windIntensity = param.value
      }
    }
  }

  generateFullyRenderedContent(): void {}

  getScreenshot(): string {
    return this._renderer.domElement.toDataURL('image/png', 'screenshot')
  }

  /**
   * Render loop
   */
  private RAF = () => {
    requestAnimationFrame((t) => {
      if (this._debugMode) {
        this._stats.begin()
        this.executeRenderLogic(t)
        this._stats.end()
      } else {
        this.executeRenderLogic(t)
      }
      this.RAF()
    })
  }

  /**
   * Custom built render logic
   * @param t current time
   */
  private executeRenderLogic(t: number) {
    if (this._previousRAF === null) {
      this._previousRAF = t
    }

    this.updateFogShaderVariables((t - this._previousRAF) * 0.001)
    this._previousRAF = t

    this._controls.update()

    this._treeGenerator.animateTrees()

    this._renderer.render(this._scene, this._camera)
  }

  /**
   * Update shader variables for the fog fragment shader
   * @param timeElapsed time elapsed since the last render cycle
   */
  private updateFogShaderVariables(timeElapsed: number): void {
    this._totalTime += timeElapsed + mapParam(this._windIntensity, 0, 1, 0, 2)
    for (const s of this._fogShaders) {
      s.uniforms.windEnabled.value = this._windEnabled
      s.uniforms.fogTime.value = this._totalTime
      s.uniforms.windIntensity.value = mapParam(
        this._windIntensity,
        0,
        1,
        0.0005,
        0.01
      )
    }
  }

  private setup(): void {
    this._lights.forEach((element) => {
      const helper = new PointLightHelper(element as PointLight)
      this._scene.add(element, helper)
    })
  }

  /**
   * Overrides the THREE.js internal fog shader
   */
  private initFogShader(): void {
    const _NOISE_GLSL = `
      //
      // Description : Array and textureless GLSL 2D/3D/4D simplex
      //               noise functions.
      //      Author : Ian McEwan, Ashima Arts.
      //  Maintainer : stegu
      //     Lastmod : 20201014 (stegu)
      //     License : Copyright (C) 2011 Ashima Arts. All rights reserved.
      //               Distributed under the MIT License. See LICENSE file.
      //               https://github.com/ashima/webgl-noise
      //               https://github.com/stegu/webgl-noise
      //
      vec3 mod289(vec3 x) {
        return x - floor(x * (1.0 / 289.0)) * 289.0;
      }
      vec4 mod289(vec4 x) {
        return x - floor(x * (1.0 / 289.0)) * 289.0;
      }
      vec4 permute(vec4 x) {
          return mod289(((x*34.0)+1.0)*x);
      }
      vec4 taylorInvSqrt(vec4 r)
      {
        return 1.79284291400159 - 0.85373472095314 * r;
      }
      float snoise(vec3 v)
      {
        const vec2  C = vec2(1.0/6.0, 1.0/3.0) ;
        const vec4  D = vec4(0.0, 0.5, 1.0, 2.0);
      // First corner
        vec3 i  = floor(v + dot(v, C.yyy) );
        vec3 x0 =   v - i + dot(i, C.xxx) ;
      // Other corners
        vec3 g = step(x0.yzx, x0.xyz);
        vec3 l = 1.0 - g;
        vec3 i1 = min( g.xyz, l.zxy );
        vec3 i2 = max( g.xyz, l.zxy );
        //   x0 = x0 - 0.0 + 0.0 * C.xxx;
        //   x1 = x0 - i1  + 1.0 * C.xxx;
        //   x2 = x0 - i2  + 2.0 * C.xxx;
        //   x3 = x0 - 1.0 + 3.0 * C.xxx;
        vec3 x1 = x0 - i1 + C.xxx;
        vec3 x2 = x0 - i2 + C.yyy; // 2.0*C.x = 1/3 = C.y
        vec3 x3 = x0 - D.yyy;      // -1.0+3.0*C.x = -0.5 = -D.y
      // Permutations
        i = mod289(i);
        vec4 p = permute( permute( permute(
                  i.z + vec4(0.0, i1.z, i2.z, 1.0 ))
                + i.y + vec4(0.0, i1.y, i2.y, 1.0 ))
                + i.x + vec4(0.0, i1.x, i2.x, 1.0 ));
      // Gradients: 7x7 points over a square, mapped onto an octahedron.
      // The ring size 17*17 = 289 is close to a multiple of 49 (49*6 = 294)
        float n_ = 0.142857142857; // 1.0/7.0
        vec3  ns = n_ * D.wyz - D.xzx;
        vec4 j = p - 49.0 * floor(p * ns.z * ns.z);  //  mod(p,7*7)
        vec4 x_ = floor(j * ns.z);
        vec4 y_ = floor(j - 7.0 * x_ );    // mod(j,N)
        vec4 x = x_ *ns.x + ns.yyyy;
        vec4 y = y_ *ns.x + ns.yyyy;
        vec4 h = 1.0 - abs(x) - abs(y);
        vec4 b0 = vec4( x.xy, y.xy );
        vec4 b1 = vec4( x.zw, y.zw );
        //vec4 s0 = vec4(lessThan(b0,0.0))*2.0 - 1.0;
        //vec4 s1 = vec4(lessThan(b1,0.0))*2.0 - 1.0;
        vec4 s0 = floor(b0)*2.0 + 1.0;
        vec4 s1 = floor(b1)*2.0 + 1.0;
        vec4 sh = -step(h, vec4(0.0));
        vec4 a0 = b0.xzyw + s0.xzyw*sh.xxyy ;
        vec4 a1 = b1.xzyw + s1.xzyw*sh.zzww ;
        vec3 p0 = vec3(a0.xy,h.x);
        vec3 p1 = vec3(a0.zw,h.y);
        vec3 p2 = vec3(a1.xy,h.z);
        vec3 p3 = vec3(a1.zw,h.w);
      //Normalise gradients
        vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2, p2), dot(p3,p3)));
        p0 *= norm.x;
        p1 *= norm.y;
        p2 *= norm.z;
        p3 *= norm.w;
      // Mix final noise value
        vec4 m = max(0.5 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
        m = m * m;
        return 105.0 * dot( m*m, vec4( dot(p0,x0), dot(p1,x1),
                                      dot(p2,x2), dot(p3,x3) ) );
      }
      float FBM(vec3 p) {
        float value = 0.0;
        float amplitude = 0.5;
        float frequency = 0.0;
        for (int i = 0; i < 6; ++i) {
          value += amplitude * snoise(p);
          p *= 2.0;
          amplitude *= 0.5;
        }
        return value;
      }
    `

    ShaderChunk.fog_fragment = `
      #ifdef USE_FOG
        vec3 fogOrigin = cameraPosition;
        vec3 fogDirection = normalize(vWorldPosition - fogOrigin);
        float fogDepth = distance(vWorldPosition, fogOrigin);
        if (windEnabled) {
          // f(p) = fbm( p + fbm( p ) )
          vec3 noiseSampleCoord = vWorldPosition * 0.00025 + vec3(0.0, 0.0, fogTime * 0.0005);
          float noiseSample = FBM(noiseSampleCoord + FBM(noiseSampleCoord)) * 0.5 + 0.5;
          fogDepth *= mix(noiseSample, 1.0, saturate((fogDepth - 5000.0) / 5000.0));
        }
        fogDepth *= fogDepth;
        float heightFactor = 0.000005;
        float fogFactor = heightFactor * exp(-fogOrigin.y * fogDensity) * (
            1.0 - exp(-fogDepth * fogDirection.y * fogDensity)) / fogDirection.y;
        fogFactor = saturate(fogFactor);
        gl_FragColor.rgb = mix( gl_FragColor.rgb, fogColor, fogFactor );
      #endif
    `

    ShaderChunk.fog_pars_fragment =
      _NOISE_GLSL +
      `
        #ifdef USE_FOG
          uniform bool windEnabled;
          uniform float fogTime;
          uniform float windIntensity;
          uniform vec3 fogColor;
          varying vec3 vWorldPosition;
          #ifdef FOG_EXP2
            uniform float fogDensity;
          #else
            uniform float fogNear;
            uniform float fogFar;
          #endif
        #endif
      `

    ShaderChunk.fog_vertex = `
      #ifdef USE_FOG
        vWorldPosition = worldPosition.xyz;
      #endif
    `

    ShaderChunk.fog_pars_vertex = `
      #ifdef USE_FOG
        varying vec3 vWorldPosition;
      #endif
    `
  }

  /**
   * Creates objects for parameters in the stores format
   * @param paramConfig Parameter config object
   */
  private createParams(paramConfig: IParameterConfig): IStoreVizParams {
    const numericParams: any = {}

    paramConfig.numericParameters.forEach((element) => {
      const id = generateID()
      numericParams[id] = {
        id,
        name: element.name,
        min: element.min,
        max: element.max,
        value: element.value,
        valueModifier: 0,
        dataConnectionId: '',
      }
    })

    const textParams: any = {}
    paramConfig.textParameters.forEach((element) => {
      const id = generateID()
      textParams[id] = {
        id,
        name: element.name,
        regex: element.regex,
        value: element.value,
        dataConnectionId: '',
      }
    })

    return { numeric: numericParams, text: textParams }
  }

  /**
   * Creates objects for live parameters in the stores format
   * @param config Parameter config object
   */
  private createLiveParams(config: IParameterConfig): IStoreLiveParams {
    const liveParams: any = {}
    config.liveParameters.forEach((element) => {
      const id = generateID()
      liveParams[id] = {
        id,
        name: element.name,
        value: element.value,
      }
    })
    return liveParams
  }

  get debugMode(): boolean {
    return this._debugMode
  }

  set debugMode(debugMode: boolean) {
    this._stats.dom.style.display = this._debugMode ? 'none' : ''
    this._debugMode = debugMode
    this._treeGenerator.setDebug(debugMode)
  }
}
