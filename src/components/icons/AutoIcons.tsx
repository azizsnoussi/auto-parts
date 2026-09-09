/**
 * Automotive icon set.
 *
 * These replace the third-party PNGs the site used to hotlink from a CDN. Inline
 * SVG is a strict improvement here:
 *  - one visual language (24×24 grid, 1.7 stroke, round caps) instead of a
 *    mixture of flat-fill and outline art from different authors,
 *  - `currentColor` means a single icon works on light and dark surfaces and can
 *    be animated with CSS,
 *  - no network request, no layout shift, no dead-link risk.
 *
 * Every icon accepts the same props as an `<svg>`, so `size`, `className` and
 * `strokeWidth` behave the way callers expect from lucide-react.
 */
import type { SVGProps } from 'react'

export interface IconProps extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  size?: number | string
}

/** Shared wrapper so stroke defaults stay identical across the whole set. */
function Icon({ size = 24, strokeWidth = 1.7, children, ...rest }: IconProps & { strokeWidth?: number | string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...rest}
    >
      {children}
    </svg>
  )
}

/* ── Part families ──────────────────────────────────────────────────────── */

/** Engine block with cam cover and pulley. */
export function EngineIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M4 13v-2a1 1 0 0 1 1-1h2V8a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2h2l2-2h2v4h1a1 1 0 0 1 1 1v3a1 1 0 0 1-1 1h-3l-2 2H8a1 1 0 0 1-1-1v-2H5a1 1 0 0 1-1-1Z" />
      <path d="M9 10V7.5" />
      <path d="M12 10V7.5" />
      <circle cx="17.5" cy="14.5" r="1" />
    </Icon>
  )
}

/** Coil spring and damper. */
export function SuspensionIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M8 3h8" />
      <path d="M8 21h8" />
      <path d="M12 3v2" />
      <path d="M12 19v2" />
      <path d="M8.5 6h7l-7 2.5h7l-7 2.5h7l-7 2.5h7l-7 2.5h7" />
    </Icon>
  )
}

/** Cylindrical oil / air filter with pleats. */
export function FilterPartIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M6 6.5c0-1.4 2.7-2.5 6-2.5s6 1.1 6 2.5" />
      <path d="M6 6.5v11c0 1.4 2.7 2.5 6 2.5s6-1.1 6-2.5v-11" />
      <path d="M6 6.5c0 1.4 2.7 2.5 6 2.5s6-1.1 6-2.5" />
      <path d="M9 10.5v7.8M12 11v8.4M15 10.5v7.8" />
    </Icon>
  )
}

/** Brake disc with caliper. */
export function BrakeIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="11" cy="12" r="7.5" />
      <circle cx="11" cy="12" r="2.8" />
      <path d="M11 4.5v2M11 17.5v2M3.5 12h2M16.5 12h2" />
      <path d="M17.5 8.5a1.5 1.5 0 0 1 1.5 1.5v4a1.5 1.5 0 0 1-1.5 1.5" />
    </Icon>
  )
}

/** Gearbox / clutch: shift pattern. */
export function ClutchIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M6 5v14M18 5v14M6 12h12" />
      <circle cx="6" cy="5" r="1.6" />
      <circle cx="18" cy="5" r="1.6" />
      <circle cx="6" cy="19" r="1.6" />
      <circle cx="18" cy="19" r="1.6" />
      <circle cx="12" cy="12" r="1.6" />
    </Icon>
  )
}

/** Radiator core with a thermometer overlay. */
export function ThermalIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <rect x="3" y="5" width="12" height="14" rx="1.6" />
      <path d="M6.5 8v8M9 8v8M11.5 8v8" />
      <path d="M19 5.5v7.2" />
      <circle cx="19" cy="16.2" r="2.3" />
    </Icon>
  )
}

/** Battery with charge bolt. */
export function BatteryIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <rect x="2.5" y="7" width="17" height="11" rx="1.8" />
      <path d="M7 7V4.5h3V7M14 7V4.5h3V7" />
      <path d="M22 11v3" />
      <path d="M12.2 9.7 9.8 13.3h2.4l-.4 3 2.6-3.9h-2.5Z" fill="currentColor" stroke="none" />
    </Icon>
  )
}

/** Car body silhouette (three-quarter profile). */
export function BodyworkIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M3 14.5v-1.8a2 2 0 0 1 .6-1.4l1.7-1.7 1.6-3A2 2 0 0 1 8.7 5.5h5.9a2 2 0 0 1 1.6.8l2.4 3.3 2.4.7a1.5 1.5 0 0 1 1 1.4v2.8H3Z" />
      <path d="M6.8 9.7h10.6" />
      <circle cx="7.3" cy="16.8" r="2" />
      <circle cx="16.8" cy="16.8" r="2" />
    </Icon>
  )
}

/** Car seat, for interior parts. */
export function InteriorIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M7 4.5h4.6a2 2 0 0 1 2 1.9l.4 6.6H8.6a2 2 0 0 1-2-1.9L6.3 6.4A2 2 0 0 1 7 4.5Z" />
      <path d="M6.5 13h8.6a2 2 0 0 1 2 2v1.5a2 2 0 0 1-2 2H8.5" />
      <path d="M5.5 19.5h3" />
    </Icon>
  )
}

/** Windscreen wiper arm sweeping a glass arc. */
export function WiperIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M3.5 18.5c0-6.6 4-11.5 8.5-11.5s8.5 4.9 8.5 11.5" />
      <path d="M6.5 19.5 15 6.8" />
      <path d="M13.4 5 17 7.4" />
      <circle cx="6.5" cy="19.5" r="1.4" />
    </Icon>
  )
}

/** Exhaust silencer with tailpipe smoke. */
export function ExhaustIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M3 13.5V11a1.5 1.5 0 0 1 1.5-1.5h6L14 12h3.5" />
      <rect x="14" y="10" width="6.5" height="4" rx="2" />
      <path d="M6 13.5V16" />
      <path d="M3.5 18.5c1.2 0 1.2-1.6 2.4-1.6s1.2 1.6 2.4 1.6" />
    </Icon>
  )
}

/* ── Services ───────────────────────────────────────────────────────────── */

/** Oil drop falling from a spout. */
export function OilChangeIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M4 7h6.5l2.5 3H17a2 2 0 0 1 2 2v1.5" />
      <path d="M6.5 7v2.5" />
      <path d="M19 16.2c0 1.3-1 2.3-2.2 2.3s-2.3-1-2.3-2.3c0-1.4 2.3-4 2.3-4s2.2 2.6 2.2 4Z" />
      <path d="M4 12.5h5" />
    </Icon>
  )
}

/** Pressure washer spraying droplets. */
export function CarWashIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M6.5 11.5V6a2 2 0 0 1 2-2h1.2a2 2 0 0 1 2 2v.7" />
      <path d="M4 11.5h5v7.5a1.5 1.5 0 0 1-1.5 1.5H5.5A1.5 1.5 0 0 1 4 19Z" />
      <path d="M13.5 7.5h6" />
      <path d="M14.5 11h5" />
      <path d="M13.5 14.5h6" />
    </Icon>
  )
}

/** Brake pad pressing a disc. */
export function BrakeServiceIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="10.5" cy="12" r="7" />
      <circle cx="10.5" cy="12" r="2.5" />
      <rect x="18" y="8.5" width="3" height="7" rx="1.2" />
      <path d="M17.5 12H19" />
    </Icon>
  )
}

/** OBD diagnostic readout on a scope. */
export function DiagnosticIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <rect x="2.5" y="4.5" width="19" height="12" rx="2" />
      <path d="M5.5 11.5h2.2l1.4-3 1.8 5 1.6-3.4 1.2 1.9h4.8" />
      <path d="M9 20h6" />
      <path d="M12 16.5V20" />
    </Icon>
  )
}

/** Air-conditioning: snowflake in a vent. */
export function AirConIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M12 3v18" />
      <path d="M4.2 7.5l15.6 9" />
      <path d="M19.8 7.5l-15.6 9" />
      <path d="M12 6.6 9.9 4.6M12 6.6l2.1-2M12 17.4l-2.1 2M12 17.4l2.1 2" />
      <path d="M6.4 10.9 3.7 10.2M6.4 13.1l-2.7.7M17.6 10.9l2.7-.7M17.6 13.1l2.7.7" />
    </Icon>
  )
}

/** Wiring loom / electrical service. */
export function ElectricalIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M13.2 2.5 5.5 13h5l-1.7 8.5L17 11h-5.2Z" />
    </Icon>
  )
}

/* ── Trust / feature icons ──────────────────────────────────────────────── */

/** Delivery van. */
export function DeliveryIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M2.5 6.5h10v9.8H2.5z" />
      <path d="M12.5 9.5h4l3 3v3.8h-7z" />
      <circle cx="6.5" cy="18" r="1.9" />
      <circle cx="16.5" cy="18" r="1.9" />
      <path d="M8.5 18h6" />
    </Icon>
  )
}

/** Headset, for customer support. */
export function SupportIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M4 13v-1a8 8 0 0 1 16 0v1" />
      <path d="M4 13h2.2a1 1 0 0 1 1 1v3.4a1 1 0 0 1-1 1H5.4A1.4 1.4 0 0 1 4 17V13Z" />
      <path d="M20 13h-2.2a1 1 0 0 0-1 1v3.4a1 1 0 0 0 1 1h.8A1.4 1.4 0 0 0 20 17V13Z" />
      <path d="M16.8 18.6a3 3 0 0 1-3 2.4H12" />
    </Icon>
  )
}

/** Price tag with a check. */
export function BestPriceIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M12.6 3.3H19a1.7 1.7 0 0 1 1.7 1.7v6.4a1.7 1.7 0 0 1-.5 1.2l-7.3 7.3a1.7 1.7 0 0 1-2.4 0l-6.4-6.4a1.7 1.7 0 0 1 0-2.4l7.3-7.3a1.7 1.7 0 0 1 1.2-.5Z" />
      <circle cx="16.4" cy="7.6" r="1.4" />
      <path d="M8.8 12.4l2 2 3.4-3.4" />
    </Icon>
  )
}

/** Certified quality shield. */
export function QualityIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M12 2.8 4.5 5.6v5.6c0 4.6 3.1 8.3 7.5 9.9 4.4-1.6 7.5-5.3 7.5-9.9V5.6Z" />
      <path d="M8.8 11.8l2.3 2.4 4.1-4.6" />
    </Icon>
  )
}

/** Genuine-parts certificate. */
export function CertifiedIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="12" cy="9.5" r="5.5" />
      <path d="M9.6 9.4l1.7 1.8 3.2-3.6" />
      <path d="M8.6 14.6 7.5 21l4.5-2.2L16.5 21l-1.1-6.4" />
    </Icon>
  )
}

/* ── Registry ───────────────────────────────────────────────────────────── */

/**
 * Icon lookup for the part-family and service grids. The keys match the i18n
 * keys in `partFamilies.*` / `homeServices.*`, so a grid can be rendered from a
 * single list of keys with no parallel icon array to keep in sync.
 */
export const PART_FAMILY_ICONS = {
  engine: EngineIcon,
  suspension: SuspensionIcon,
  filtration: FilterPartIcon,
  braking: BrakeIcon,
  clutch: ClutchIcon,
  thermal: ThermalIcon,
  starting: BatteryIcon,
  bodywork: BodyworkIcon,
  interior: InteriorIcon,
  wipers: WiperIcon,
  rearWipers: WiperIcon,
  exhaust: ExhaustIcon,
} as const

export const SERVICE_ICONS = {
  oilChange: OilChangeIcon,
  wash: CarWashIcon,
  brakes: BrakeServiceIcon,
  diagnostic: DiagnosticIcon,
  ac: AirConIcon,
  electrical: ElectricalIcon,
} as const

export type PartFamilyKey = keyof typeof PART_FAMILY_ICONS
export type ServiceKey = keyof typeof SERVICE_ICONS
