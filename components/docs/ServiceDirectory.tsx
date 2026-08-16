"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, Search, X } from "lucide-react";
import { SERVICES, SERVICE_GROUPS } from "@/lib/docs/services";

export function ServiceDirectory() {
  const [query, setQuery] = useState("");
  const [group, setGroup] = useState("all");
  const normalizedQuery = query.trim().toLowerCase();

  const filteredServices = useMemo(
    () =>
      SERVICES.filter((service) => {
        const inGroup = group === "all" || service.group === group;
        const matchesQuery =
          !normalizedQuery ||
          `${service.title} ${service.description} ${service.longDescription}`
            .toLowerCase()
            .includes(normalizedQuery);
        return inGroup && matchesQuery;
      }),
    [group, normalizedQuery],
  );

  return (
    <section className="mt-12" aria-labelledby="service-directory-heading">
      <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
        <div>
          <p className="eyebrow">Service directory</p>
          <h2 id="service-directory-heading" className="mt-2 text-3xl font-bold">
            Find the control you need
          </h2>
          <p className="mt-2 max-w-2xl text-slate-300">
            Choose a service to open only its setup workflow, verification steps, API route, and related guidance.
          </p>
        </div>
        <label className="relative block w-full lg:max-w-sm">
          <span className="sr-only">Search security services</span>
          <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} aria-hidden="true" />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search services or outcomes"
            className="input h-11 pl-10 pr-10"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery("")}
              aria-label="Clear service search"
              className="absolute right-2 top-1/2 inline-flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-md text-slate-400 hover:bg-slate-800 hover:text-white"
            >
              <X size={16} aria-hidden="true" />
            </button>
          )}
        </label>
      </div>

      <div className="mt-6 flex gap-2 overflow-x-auto pb-2" aria-label="Filter services by category">
        <button
          type="button"
          onClick={() => setGroup("all")}
          aria-pressed={group === "all"}
          className={`h-9 shrink-0 rounded-md border px-3 text-sm font-medium transition ${
            group === "all"
              ? "border-cyan/40 bg-cyan/10 text-cyan"
              : "border-slate-700 text-slate-300 hover:border-slate-500 hover:text-white"
          }`}
        >
          All ({SERVICES.length})
        </button>
        {SERVICE_GROUPS.map((item) => {
          const count = SERVICES.filter((service) => service.group === item.id).length;
          const active = group === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setGroup(item.id)}
              aria-pressed={active}
              className={`h-9 shrink-0 rounded-md border px-3 text-sm font-medium transition ${
                active
                  ? "border-cyan/40 bg-cyan/10 text-cyan"
                  : "border-slate-700 text-slate-300 hover:border-slate-500 hover:text-white"
              }`}
            >
              {item.label} ({count})
            </button>
          );
        })}
      </div>

      <p className="mt-3 text-sm text-slate-400" aria-live="polite">
        {filteredServices.length} {filteredServices.length === 1 ? "service" : "services"} shown
      </p>

      {filteredServices.length > 0 ? (
        <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredServices.map((service) => {
            const Icon = service.icon;
            const groupLabel = SERVICE_GROUPS.find((item) => item.id === service.group)?.label;
            return (
              <Link
                key={service.id}
                href={`/docs/services/${service.id}`}
                className="group flex min-h-52 flex-col rounded-lg border border-slate-800 bg-panel/70 p-5 transition hover:border-cyan/45 hover:bg-panel"
              >
                <div className="flex items-start justify-between gap-4">
                  <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-md ${service.bg} ${service.color}`}>
                    <Icon size={20} aria-hidden="true" />
                  </span>
                  <span className="text-xs font-medium text-slate-400">{groupLabel}</span>
                </div>
                <h3 className="mt-4 text-lg font-semibold text-white group-hover:text-cyan">{service.title}</h3>
                <p className="mt-2 flex-1 text-sm leading-6 text-slate-300">{service.description}</p>
                <span className="mt-5 inline-flex items-center gap-1.5 text-sm font-semibold text-cyan">
                  Open setup guide
                  <ArrowRight size={15} className="transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
                </span>
              </Link>
            );
          })}
        </div>
      ) : (
        <div className="mt-5 rounded-lg border border-dashed border-slate-700 px-6 py-12 text-center">
          <h3 className="font-semibold">No matching services</h3>
          <p className="mt-2 text-sm text-slate-300">Try a broader term or clear the category filter.</p>
          <button
            type="button"
            onClick={() => {
              setQuery("");
              setGroup("all");
            }}
            className="button-secondary mt-5 !px-4 !py-2 text-sm"
          >
            Reset filters
          </button>
        </div>
      )}
    </section>
  );
}