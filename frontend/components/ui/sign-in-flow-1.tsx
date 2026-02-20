'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'

import { cn } from '@/lib/utils'

type UniformValue = number[] | number[][] | number

type Uniforms = Record<
  string,
  {
    value: UniformValue
    type: 'uniform1f' | 'uniform1i' | 'uniform1fv' | 'uniform3fv' | 'uniform2f'
  }
>

interface ShaderProps {
  source: string
  uniforms: Uniforms
  maxFps?: number
}

interface DotMatrixProps {
  colors?: number[][]
  opacities?: number[]
  totalSize?: number
  dotSize?: number
  reverse?: boolean
}

interface CanvasRevealEffectProps {
  animationSpeed?: number
  opacities?: number[]
  colors?: number[][]
  containerClassName?: string
  dotSize?: number
  showGradient?: boolean
  reverse?: boolean
}

export interface AuthFlowFrameProps {
  title: string
  subtitle?: string
  children: React.ReactNode
  footer?: React.ReactNode
  className?: string
}

function supportsWebGL() {
  if (typeof window === 'undefined') return false
  try {
    const canvas = document.createElement('canvas')
    return !!(canvas.getContext('webgl') || canvas.getContext('experimental-webgl'))
  } catch {
    return false
  }
}

const ShaderMaterialMesh = ({ source, uniforms, maxFps = 60 }: ShaderProps) => {
  const { size } = useThree()
  const meshRef = useRef<any>(null)
  const lastTimeRef = useRef(0)

  const preparedUniforms = useMemo<Record<string, any>>(() => {
    const mapped: Record<string, any> = {}

    for (const [uniformName, uniformDef] of Object.entries(uniforms)) {
      if (uniformDef.type === 'uniform1f' || uniformDef.type === 'uniform1i') {
        mapped[uniformName] = { value: uniformDef.value as number }
      } else if (uniformDef.type === 'uniform1fv') {
        mapped[uniformName] = { value: uniformDef.value as number[] }
      } else if (uniformDef.type === 'uniform3fv') {
        mapped[uniformName] = {
          value: (uniformDef.value as number[][]).map((v) => new THREE.Vector3(v[0], v[1], v[2])),
        }
      } else if (uniformDef.type === 'uniform2f') {
        const vec = uniformDef.value as number[]
        mapped[uniformName] = { value: new THREE.Vector2(vec[0], vec[1]) }
      }
    }

    mapped.u_time = { value: 0 }
    mapped.u_resolution = { value: new THREE.Vector2(size.width * 2, size.height * 2) }

    return mapped
  }, [uniforms, size.width, size.height])

  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: `
          precision mediump float;
          out vec2 fragCoord;
          uniform vec2 u_resolution;
          void main() {
            gl_Position = vec4(position, 1.0);
            fragCoord = (position.xy + vec2(1.0)) * 0.5 * u_resolution;
            fragCoord.y = u_resolution.y - fragCoord.y;
          }
        `,
        fragmentShader: source,
        uniforms: preparedUniforms,
        glslVersion: THREE.GLSL3,
        blending: THREE.CustomBlending,
        blendSrc: THREE.SrcAlphaFactor,
        blendDst: THREE.OneFactor,
        transparent: true,
      }),
    [source, preparedUniforms],
  )

  useEffect(() => {
    return () => {
      material.dispose()
    }
  }, [material])

  useFrame(({ clock }) => {
    if (!meshRef.current) return
    const elapsed = clock.getElapsedTime()
    const minFrameTime = 1 / maxFps
    if (elapsed - lastTimeRef.current < minFrameTime) return
    lastTimeRef.current = elapsed

    const meshMaterial = meshRef.current.material as any
    meshMaterial.uniforms.u_time.value = elapsed
    meshMaterial.uniforms.u_resolution.value = new THREE.Vector2(size.width * 2, size.height * 2)
  })

  return (
    <mesh ref={meshRef}>
      <planeGeometry args={[2, 2]} />
      <primitive object={material} attach="material" />
    </mesh>
  )
}

const Shader = ({ source, uniforms, maxFps = 60 }: ShaderProps) => {
  return (
    <Canvas className="absolute inset-0 h-full w-full">
      <ShaderMaterialMesh source={source} uniforms={uniforms} maxFps={maxFps} />
    </Canvas>
  )
}

const DotMatrix = ({
  colors = [[59, 130, 246], [249, 115, 22]],
  opacities = [0.1, 0.1, 0.15, 0.18, 0.2, 0.25, 0.3, 0.35, 0.45, 0.55],
  totalSize = 20,
  dotSize = 2,
  reverse = false,
}: DotMatrixProps) => {
  const uniforms = useMemo(() => {
    let colorsArray = [colors[0], colors[0], colors[0], colors[1] ?? colors[0], colors[1] ?? colors[0], colors[1] ?? colors[0]]
    if (colors.length >= 3) {
      colorsArray = [colors[0], colors[0], colors[1], colors[1], colors[2], colors[2]]
    }

    return {
      u_colors: {
        value: colorsArray.map((color) => [color[0] / 255, color[1] / 255, color[2] / 255]),
        type: 'uniform3fv' as const,
      },
      u_opacities: { value: opacities, type: 'uniform1fv' as const },
      u_total_size: { value: totalSize, type: 'uniform1f' as const },
      u_dot_size: { value: dotSize, type: 'uniform1f' as const },
      u_reverse: { value: reverse ? 1 : 0, type: 'uniform1i' as const },
      u_anim_speed: { value: 1, type: 'uniform1f' as const },
    }
  }, [colors, opacities, totalSize, dotSize, reverse])

  const source = `
    precision mediump float;
    in vec2 fragCoord;
    out vec4 fragColor;

    uniform float u_time;
    uniform float u_opacities[10];
    uniform vec3 u_colors[6];
    uniform float u_total_size;
    uniform float u_dot_size;
    uniform vec2 u_resolution;
    uniform int u_reverse;
    uniform float u_anim_speed;

    float PHI = 1.6180339887498948;
    float random(vec2 xy) {
      return fract(tan(distance(xy * PHI, xy) * 0.5) * xy.x);
    }

    void main() {
      vec2 st = fragCoord.xy;
      st.x -= abs(floor((mod(u_resolution.x, u_total_size) - u_dot_size) * 0.5));
      st.y -= abs(floor((mod(u_resolution.y, u_total_size) - u_dot_size) * 0.5));

      float opacity = step(0.0, st.x) * step(0.0, st.y);
      vec2 st2 = vec2(int(st.x / u_total_size), int(st.y / u_total_size));

      float frequency = 5.0;
      float show_offset = random(st2);
      float rand = random(st2 * floor((u_time / frequency) + show_offset + frequency));
      opacity *= u_opacities[int(rand * 10.0)];
      opacity *= 1.0 - step(u_dot_size / u_total_size, fract(st.x / u_total_size));
      opacity *= 1.0 - step(u_dot_size / u_total_size, fract(st.y / u_total_size));

      vec3 color = u_colors[int(show_offset * 6.0)];

      vec2 center_grid = u_resolution / 2.0 / u_total_size;
      float dist_from_center = distance(center_grid, st2);
      float max_grid_dist = distance(center_grid, vec2(0.0, 0.0));

      float timing_offset_intro = dist_from_center * 0.012 + (random(st2) * 0.12);
      float timing_offset_outro = (max_grid_dist - dist_from_center) * 0.02 + (random(st2 + 31.0) * 0.2);

      float t = u_time * u_anim_speed;
      float current_timing_offset = u_reverse == 1 ? timing_offset_outro : timing_offset_intro;

      if (u_reverse == 1) {
        opacity *= 1.0 - step(current_timing_offset, t);
      } else {
        opacity *= step(current_timing_offset, t);
      }

      fragColor = vec4(color, opacity);
      fragColor.rgb *= fragColor.a;
    }
  `

  return <Shader source={source} uniforms={uniforms} maxFps={60} />
}

export const CanvasRevealEffect = ({
  animationSpeed = 1,
  opacities = [0.12, 0.14, 0.16, 0.2, 0.24, 0.3, 0.36, 0.42, 0.48, 0.58],
  colors = [[59, 130, 246], [249, 115, 22]],
  containerClassName,
  dotSize = 3,
  showGradient = true,
  reverse = false,
}: CanvasRevealEffectProps) => {
  return (
    <div className={cn('h-full relative w-full', containerClassName)}>
      <div className="h-full w-full">
        <DotMatrix colors={colors} dotSize={dotSize} opacities={opacities} totalSize={20 / animationSpeed} reverse={reverse} />
      </div>
      {showGradient && <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />}
    </div>
  )
}

function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="text-sm text-slate-300 hover:text-white transition-colors relative after:absolute after:left-0 after:-bottom-1 after:h-px after:w-0 after:bg-orange-400 after:transition-all hover:after:w-full"
    >
      {children}
    </Link>
  )
}

export function AuthMiniNavbar() {
  const [isOpen, setIsOpen] = useState(false)
  const [headerShapeClass, setHeaderShapeClass] = useState('rounded-full')
  const shapeTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    if (shapeTimeoutRef.current) clearTimeout(shapeTimeoutRef.current)
    if (isOpen) {
      setHeaderShapeClass('rounded-2xl')
    } else {
      shapeTimeoutRef.current = setTimeout(() => setHeaderShapeClass('rounded-full'), 300)
    }
    return () => {
      if (shapeTimeoutRef.current) clearTimeout(shapeTimeoutRef.current)
    }
  }, [isOpen])

  return (
    <header
      className={cn(
        'fixed top-6 left-1/2 -translate-x-1/2 z-30 border border-white/15 bg-black/40 backdrop-blur-xl',
        'px-5 py-3 w-[calc(100%-2rem)] max-w-5xl transition-all duration-300',
        headerShapeClass,
      )}
    >
      <div className="flex items-center justify-between gap-x-6">
        <Link href="/" className="flex items-center gap-3">
          <div className="relative w-8 h-8">
            <motion.div
              className="absolute inset-0 rounded-full"
              style={{ background: 'linear-gradient(135deg, #f59e0b 0%, #f97316 40%, #3b82f6 100%)' }}
              animate={{ rotate: 360 }}
              transition={{ duration: 8, repeat: Infinity, ease: 'linear' }}
            />
            <div className="absolute inset-[2px] rounded-full bg-black/70 flex items-center justify-center overflow-hidden">
              <Image src="/logo.png" alt="ParLeap logo" width={18} height={18} className="w-[18px] h-[18px]" />
            </div>
          </div>
          <span className="text-white text-lg font-semibold">ParLeap</span>
        </Link>

        <nav className="hidden sm:flex items-center space-x-6">
          <NavLink href="/#features">Features</NavLink>
          <NavLink href="/#pricing">Pricing</NavLink>
          <NavLink href="/#download">Download</NavLink>
        </nav>

        <div className="hidden sm:flex items-center gap-3">
          <Link href="/auth/login" className="px-4 py-2 text-sm text-slate-300 hover:text-white transition-colors">
            Sign In
          </Link>
          <Link
            href="/auth/signup"
            className="rounded-full px-5 py-2 text-sm font-semibold text-white bg-gradient-to-r from-[#FF8C42] to-[#FF3C38] hover:opacity-90 transition"
          >
            Get Started
          </Link>
        </div>

        <button
          className="sm:hidden w-8 h-8 text-slate-200"
          onClick={() => setIsOpen((v) => !v)}
          aria-label={isOpen ? 'Close menu' : 'Open menu'}
          type="button"
        >
          {isOpen ? '✕' : '☰'}
        </button>
      </div>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="sm:hidden overflow-hidden"
          >
            <div className="pt-4 space-y-4 flex flex-col">
              <Link href="/#features" className="text-slate-300 hover:text-white">
                Features
              </Link>
              <Link href="/#pricing" className="text-slate-300 hover:text-white">
                Pricing
              </Link>
              <Link href="/#download" className="text-slate-300 hover:text-white">
                Download
              </Link>
              <Link href="/auth/login" className="text-slate-300 hover:text-white">
                Sign In
              </Link>
              <Link
                href="/auth/signup"
                className="rounded-full px-4 py-2 text-center text-sm font-semibold text-white bg-gradient-to-r from-[#FF8C42] to-[#FF3C38]"
              >
                Get Started
              </Link>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  )
}

export function AuthFlowFrame({ title, subtitle, children, footer, className }: AuthFlowFrameProps) {
  const reduceMotion = useReducedMotion()
  const [showCanvas, setShowCanvas] = useState(false)

  useEffect(() => {
    setShowCanvas(!reduceMotion && supportsWebGL())
  }, [reduceMotion])

  return (
    <div className={cn('relative min-h-screen overflow-hidden bg-black', className)}>
      <div className="absolute inset-0 z-0">
        {showCanvas ? (
          <CanvasRevealEffect
            animationSpeed={1.1}
            containerClassName="bg-black"
            colors={[[59, 130, 246], [30, 64, 175], [249, 115, 22]]}
            dotSize={4}
          />
        ) : (
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_30%,rgba(30,64,175,0.35),transparent_55%),linear-gradient(to_bottom,#020617,#000000)]" />
        )}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(0,0,0,0.08)_0%,rgba(0,0,0,0.7)_100%)]" />
      </div>

      <AuthMiniNavbar />

      <div className="relative z-10 flex min-h-screen items-center justify-center px-4 pt-28 pb-10">
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: 'easeOut' }}
          className="w-full max-w-md rounded-2xl border border-white/10 bg-slate-950/55 p-8 shadow-2xl shadow-black/40 backdrop-blur-xl"
        >
          <div className="mb-6 text-center">
            <h1 className="text-4xl font-bold leading-tight tracking-tight text-white">{title}</h1>
            {subtitle ? <p className="mt-2 text-slate-300">{subtitle}</p> : null}
          </div>
          {children}
          {footer ? <div className="mt-6">{footer}</div> : null}
        </motion.div>
      </div>
    </div>
  )
}
