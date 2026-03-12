// SombreroHome — Printing Press artifact #001 (v2)
// Redesigned from real sombrero reference (SVGRepo + anatomy study)
// Key fixes: brim dramatically wider than crown, proper dome crown, pompom, upturned brim tips
export default function SombreroHome({ className = 'w-8 h-8' }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" className={className} aria-hidden="true">
      {/* ── BRIM (dominant element — 95% of canvas width) ── */}
      {/* Shadow layer for depth */}
      <ellipse cx="32" cy="47" rx="30" ry="5" fill="#9A7209" opacity="0.35"/>
      {/* Main brim */}
      <ellipse cx="32" cy="45" rx="30" ry="5.5" fill="#E8B820"/>
      {/* Brim top surface highlight */}
      <ellipse cx="32" cy="43.5" rx="29" ry="4" fill="#F0C830" opacity="0.5"/>
      {/* Upturned brim tips — left */}
      <path d="M2 45 Q5 40 12 42 Q8 45 2 45Z" fill="#D4A017"/>
      {/* Upturned brim tips — right */}
      <path d="M62 45 Q59 40 52 42 Q56 45 62 45Z" fill="#D4A017"/>

      {/* ── CROWN (rounded dome, 38% of brim width) ── */}
      {/* Crown body — smooth dome profile */}
      <path d="M21 44 Q19 32 21 22 Q25 11 32 10 Q39 11 43 22 Q45 32 43 44Z" fill="#E8B820"/>
      {/* Crown left shading for roundness */}
      <path d="M21 44 Q20 32 22 22 Q26 13 30 11" fill="none" stroke="#C8960A" strokeWidth="1.5" strokeLinecap="round" opacity="0.6"/>
      {/* Crown top highlight */}
      <path d="M28 12 Q32 9 36 12" fill="none" stroke="#F5D040" strokeWidth="1.2" strokeLinecap="round" opacity="0.7"/>

      {/* ── DECORATIVE BAND (where crown meets brim) ── */}
      <path d="M21 40 Q32 43 43 40 L43 43 Q32 46 21 43Z" fill="#C0392B"/>
      {/* Band embroidery dots */}
      <circle cx="26" cy="41.8" r="1.1" fill="#F0EDE8" opacity="0.85"/>
      <circle cx="32" cy="42.5" r="1.1" fill="#F0EDE8" opacity="0.85"/>
      <circle cx="38" cy="41.8" r="1.1" fill="#F0EDE8" opacity="0.85"/>
      {/* Band gold stripe */}
      <path d="M21 38.5 Q32 41 43 38.5" fill="none" stroke="#F0C830" strokeWidth="1" opacity="0.6"/>

      {/* ── POMPOM (top of crown — classic mariachi detail) ── */}
      <circle cx="32" cy="10" r="3" fill="#C0392B"/>
      <circle cx="32" cy="9.5" r="1.5" fill="#E05050" opacity="0.6"/>

      {/* ── BRIM FRINGE DOTS ── */}
      <circle cx="9"  cy="44.5" r="1"   fill="#C8960A" opacity="0.7"/>
      <circle cx="15" cy="43.5" r="0.9" fill="#C8960A" opacity="0.7"/>
      <circle cx="49" cy="43.5" r="0.9" fill="#C8960A" opacity="0.7"/>
      <circle cx="55" cy="44.5" r="1"   fill="#C8960A" opacity="0.7"/>
    </svg>
  )
}
