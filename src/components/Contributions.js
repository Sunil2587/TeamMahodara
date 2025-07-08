import React, { useEffect, useState } from "react";
import PageContainer from "../components/PageContainer";
import BackgroundWrapper from "../components/BackgroundWrapper";
import { supabase } from "../supabaseClient";

const getDefaultContributor = () => localStorage.getItem("profileName") || "";

export default function Contributions() {
  const [contributions, setContributions] = useState([]);
  const [contributor, setContributor] = useState(getDefaultContributor());
  const [amount, setAmount] = useState("");
  const [paymentMode, setPaymentMode] = useState("cash");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchContributions();
    // Load Cashfree Drop SDK
    if (!window.Cashfree) {
      const script = document.createElement("script");
      script.src = "https://sdk.cashfree.com/js/v3/cashfree.js";
      script.async = true;
      document.body.appendChild(script);
    }
  }, []);

  async function fetchContributions() {
    const { data, error } = await supabase
      .from("contributions")
      .select("*")
      .order("created_at", { ascending: false });
    if (!error) setContributions(data || []);
  }

  async function handleAddContribution(e) {
    e.preventDefault();
    if (!contributor.trim() || !amount || isNaN(Number(amount)) || Number(amount) <= 0) {
      alert("Please enter a valid contributor name and amount.");
      return;
    }

    setLoading(true);
    const { error } = await supabase.from("contributions").insert([
      {
        contributor,
        amount: parseFloat(amount),
        method: "cash",
        status: "success",
        note: "Paid in cash",
      },
    ]);
    setLoading(false);

    if (!error) {
      setAmount("");
      fetchContributions();
    } else {
      alert("Failed to add cash contribution.");
    }
  }

  async function handleOnlinePayment(e) {
    e.preventDefault();
    if (!contributor.trim() || !amount || isNaN(Number(amount)) || Number(amount) <= 0) {
      alert("Please enter a valid contributor name and amount.");
      return;
    }

    try {
      localStorage.setItem("profileName", contributor.trim());

      const response = await fetch("https://ttdctwfsfvlizsjvsjfo.functions.supabase.co/create-payment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contributor: contributor.trim(),
          amount: parseFloat(amount),
        }),
      });

      const data = await response.json();

      if (!data?.payment_session_id) {
        alert("Failed to create payment session.");
        return;
      }

      if (!window.Cashfree) {
        alert("Cashfree SDK not loaded.");
        return;
      }

      const cashfree = new window.Cashfree(data.payment_session_id);
      cashfree.redirect();
    } catch (err) {
      console.error("Cashfree Error:", err);
      alert("Payment failed. Please try again.");
    }
  }

  async function handleDeleteContribution(id) {
    if (!window.confirm("Delete this contribution?")) return;
    const { error } = await supabase.from("contributions").delete().eq("id", id);
    if (!error) fetchContributions();
    else alert("Failed to delete contribution.");
  }

  const totalContribution = contributions.reduce(
    (sum, c) => sum + (parseFloat(c.amount) || 0),
    0
  );

  return (
    <BackgroundWrapper>
      <PageContainer title="CONTRIBUTIONS">
        <div className="flex justify-center gap-4 mb-2">
          <button
            onClick={() => setPaymentMode("cash")}
            className={`px-4 py-2 rounded ${paymentMode === "cash" ? "bg-yellow-500 text-white" : "bg-gray-200"}`}
          >
            Pay Cash
          </button>
          <button
            onClick={() => setPaymentMode("online")}
            className={`px-4 py-2 rounded ${paymentMode === "online" ? "bg-yellow-500 text-white" : "bg-gray-200"}`}
          >
            Pay Online
          </button>
        </div>

        <form
          onSubmit={paymentMode === "cash" ? handleAddContribution : handleOnlinePayment}
          className="flex flex-col gap-2 px-4 pb-4"
        >
          <input
            type="text"
            placeholder="Contributor Name"
            className="rounded-lg px-3 py-2 border border-yellow-400 bg-white/70 focus:outline-none text-black"
            value={contributor}
            onChange={(e) => {
              setContributor(e.target.value);
              localStorage.setItem("profileName", e.target.value);
            }}
            required
          />
          <input
            type="number"
            min="1"
            step="0.01"
            placeholder="Amount"
            className="rounded-lg px-3 py-2 border border-yellow-400 bg-white/70 focus:outline-none text-black"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            required
          />
          <button
            type="submit"
            disabled={loading}
            className="bg-yellow-500 hover:bg-yellow-600 text-white font-bold py-2 rounded-lg transition"
          >
            {loading
              ? "Processing..."
              : paymentMode === "cash"
              ? "Add Cash Contribution"
              : "Pay Online"}
          </button>
        </form>

        <div className="text-center text-yellow-900 font-bold mb-2">
          Total Contribution: ₹{totalContribution}
        </div>

        <div className="grid grid-cols-2 gap-2 px-3 pb-8 mt-4">
          {contributions.map((c) => (
            <div
              key={c.id}
              className="relative rounded-xl shadow p-2 flex flex-col items-center justify-center gap-1 transition"
              style={{
                minHeight: "54px",
                fontSize: "0.95rem",
                background: "rgba(255,255,255,0.35)",
                backdropFilter: "blur(2px)",
                color: "#166534",
              }}
            >
              <span className="text-xl mb-0.5" style={{ color: "#388e3c" }}>₹</span>
              <span className="text-xs font-semibold">{c.contributor}</span>
              <span className="text-sm font-bold mt-0.5">{c.amount}</span>
              <span className="text-xs text-gray-700">{c.method.toUpperCase()}</span>
              <button
                onClick={() => handleDeleteContribution(c.id)}
                className="absolute top-2 right-2 bg-red-500 hover:bg-red-600 text-white rounded-full px-2 py-1 text-xs font-bold shadow transition"
              >
                Delete
              </button>
            </div>
          ))}
        </div>
      </PageContainer>
    </BackgroundWrapper>
  );
}
  