export default function SummaryLine({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className={strong ? "summary-line strong" : "summary-line"}>
      <span>{label}</span>
      <span>{value}</span>
    </div>
  )
}
