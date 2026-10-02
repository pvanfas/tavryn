"use client";

import { useRouter } from "next/navigation";
import React, { useMemo, useState } from "react";

import { AnalysisModal } from "./AnalysisModal";
import {
  DesktopOpportunitiesTable,
  MobileOpportunitiesList,
  OpportunitiesHeader,
  OpportunitiesPagination,
  OpportunitiesTableProps,
  OpportunityItem,
} from "./opportunities";

export type { OpportunityItem };

export function OpportunitiesTable({
  opportunities,
  businessId,
}: OpportunitiesTableProps) {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [selectedContract, setSelectedContract] = useState<{
    id: string;
    service: string;
    currentPrice: number;
  } | null>(null);

  const [isRunningAgent, setIsRunningAgent] = useState(false);
  const [agentNotice, setAgentNotice] = useState<string | null>(null);

  const handleRunAgentNow = async () => {
    setIsRunningAgent(true);
    setAgentNotice(null);
    try {
      const res = await fetch("/api/agent/run-now", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ businessId }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Agent execution failed");
      }

      const started = data.result?.totalNegotiationsStarted ?? 0;
      const notifs = data.result?.totalNotificationsCreated ?? 0;
      setAgentNotice(
        `Autonomous agent completed: ${started} negotiation(s) initiated, ${notifs} notification(s) created.`,
      );
      router.refresh();
    } catch (err) {
      setAgentNotice(`Agent run failed: ${(err as Error).message}`);
    } finally {
      setIsRunningAgent(false);
    }
  };

  // Filtered dataset
  const filtered = useMemo(() => {
    return opportunities.filter((item) => {
      const matchesSearch =
        searchQuery === "" ||
        item.service.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (item.vendors?.name || "")
          .toLowerCase()
          .includes(searchQuery.toLowerCase()) ||
        item.category.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesCategory =
        categoryFilter === "all" ||
        item.category.toLowerCase() === categoryFilter.toLowerCase();

      return matchesSearch && matchesCategory;
    });
  }, [opportunities, searchQuery, categoryFilter]);

  const totalRecords = filtered.length;
  const totalPages = Math.max(1, Math.ceil(totalRecords / rowsPerPage));
  const startIndex = (currentPage - 1) * rowsPerPage;
  const paginatedRows = filtered.slice(startIndex, startIndex + rowsPerPage);

  return (
    <>
      <div className="rounded-xl bg-white/90 dark:bg-[#111714]/90 border border-slate-200/70 dark:border-slate-800/60 shadow-[0_1px_3px_rgba(0,0,0,0.03),0_6px_16px_rgba(0,0,0,0.02)] dark:shadow-[0_1px_3px_rgba(0,0,0,0.2)] p-5 sm:p-6 transition-colors">
        {/* Card Header & Controls */}
        <OpportunitiesHeader
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          categoryFilter={categoryFilter}
          setCategoryFilter={setCategoryFilter}
          onResetPage={() => setCurrentPage(1)}
          onRunAgentNow={handleRunAgentNow}
          isRunningAgent={isRunningAgent}
          agentNotice={agentNotice}
          onDismissNotice={() => setAgentNotice(null)}
        />

        {/* Desktop Ledger Table */}
        <DesktopOpportunitiesTable
          paginatedRows={paginatedRows}
          startIndex={startIndex}
          onSelectContract={setSelectedContract}
        />

        {/* Mobile Card View */}
        <MobileOpportunitiesList
          paginatedRows={paginatedRows}
          startIndex={startIndex}
          onSelectContract={setSelectedContract}
        />

        {/* Ledger Footer (Pagination & Record Counts) */}
        <OpportunitiesPagination
          totalRecords={totalRecords}
          startIndex={startIndex}
          rowsPerPage={rowsPerPage}
          setRowsPerPage={setRowsPerPage}
          currentPage={currentPage}
          totalPages={totalPages}
          setCurrentPage={setCurrentPage}
        />
      </div>

      {selectedContract && (
        <AnalysisModal
          contractId={selectedContract.id}
          serviceName={selectedContract.service}
          currentPrice={selectedContract.currentPrice}
          isOpen={true}
          onClose={() => setSelectedContract(null)}
        />
      )}
    </>
  );
}
