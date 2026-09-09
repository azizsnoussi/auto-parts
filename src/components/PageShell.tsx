import React from "react"

export default function PageShell({
  eyebrow,
  title,
  children,
}: {
  eyebrow: string
  title: string
  children: React.ReactNode
}) {
  return (
    <section className="page-shell">
      <div className="section-heading">
        <div>
          <p>{eyebrow}</p>
          <h1>{title}</h1>
        </div>
      </div>
      {children}
    </section>
  )
}
