import React, { useEffect, useState, useCallback } from "react";
import { supabase } from "../supabaseClient";
import PageContainer from "../components/PageContainer";
import BackgroundWrapper from "../components/BackgroundWrapper";
import { useAuth } from "../hooks/useAuth";

export default function Contributions() {
  const { user } = useAuth();
  const [contributions, setContributions] = useState([]);
  const [contributor, setContributor] = useState("");
  const [amount, setAmount] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchProfile = async () => {
      if (user) {
        const { data } = await supabase
          .from("users")
          .select("name")
          .eq("id", user.id)
          .single();
        if (data?.name) {
          setContributor(data.name);
        }
      }
    };
    fetchProfile();
  }, [user]);

  const fetchContributions = useCallback(async () => {
    const { data, error: fetchError } = await supabase
      .from("contributions")
      .select("*")
      .order("created_at", { ascending: false });

    if (fetchError) setError("Failed to fetch contributions.");
    else setContributions(data || []);
  }, []);

  useEffect(() => {
    fetchContributions();
  }, [fetchContributions]);

  const handlePayOnline = async () => {
    if (!validateForm()) return;
    setLoading(true);
    setError(null); // Clear previous errors

    let newContribution;
    try {
      const { data, error: insertError } = await supabase
        .from("contributions")
        .insert([{
          contributor: contributor.trim(),
          amount: +amount,
          method: "online",
          status: "pending",
        }])
        .select()
        .single();

      if (insertError) {
        throw new Error(insertError.message || "Could not save contribution.");
      }
      newContribution = data;
    } catch (err) {
      setError(`Database error: ${err.message}`);
      setLoading(false);
      return;
    }

    try {
      console.log("Invoking 'create-cashfree-order' function with:", {
        amount: +amount,
        contributor: contributor.trim(),
        contribution_id: newContribution.id,
      });

      // Call the Supabase Edge Function
      const { data: functionData, error: functionError } = await supabase.functions.invoke('create-cashfree-order', {
        body: {
          amount: +amount,
          contributor: contributor.trim(),
          contribution_id: newContribution.id,
        },
      });

      console.log("Function response:", { functionData, functionError });

      if (functionError) {
        // Handle errors returned from the function itself
        // The actual error message from the function is in the 'context' property
        const detailedError = functionError.context?.error || functionError.message;
        throw new Error(detailedError);
      }

      if (functionData && functionData.payment_session_id) {
        console.log("Received payment session ID:", functionData.payment_session_id);
        
        if (!window.Cashfree) {
          throw new Error("Cashfree SDK is not loaded. Please check your index.html file.");
        }

        // Initialize the SDK with the mode. The SDK is throwing an error if this is not provided.
        const cashfreeMode = process.env.REACT_APP_CASHFREE_MODE || 'sandbox';
        const cashfree = new window.Cashfree({
          mode: cashfreeMode, // Use environment variable. Defaults to 'sandbox'.
        });
        
        console.log("Initiating Cashfree redirect...");
        cashfree.checkout({ 
          paymentSessionId: functionData.payment_session_id, // Pass the session ID here as the error suggests
          paymentStyle: "redirect"
        }).then((result) => {
          if (result.error) {
            // This is a specific error from the Cashfree SDK if the session_id is invalid
            console.error("Cashfree SDK reported an error:", result.error);
            setError(`Payment Error: ${result.error.message}. Please check the console for details.`);
            setLoading(false);
          }
          // If result.redirect is true, the browser will navigate away. No need to do anything.
        }).catch(err => {
          // This catches other potential errors during checkout initialization
          console.error("Error during cashfree.checkout() call:", err);
          setError(`A problem occurred with the payment gateway: ${err.message}`);
          setLoading(false);
        });
      } else {
        // This case handles when the function runs but doesn't return the expected data.
        throw new Error("Failed to get a valid payment session from the server.");
      }

    } catch (err) {
      // This will catch errors from the function invocation, or from our own thrown errors.
      console.error("Payment process error:", err);
      setError(`Payment initiation failed: ${err.message}`);
      setLoading(false);
    }
  };

  const handleAddContribution = async () => {
    if (!validateForm()) return;
    setLoading(true);
    const { error: insertError } = await supabase.from("contributions").insert([
      { contributor: contributor.trim(), amount: +amount, method: "cash", status: "success" },
    ]);
    setLoading(false);
    if (!insertError) {
      setAmount("");
      fetchContributions();
    } else {
      setError("Cash contribution failed.");
    }
  };

  const validateForm = () => {
    setError(null);
    if (!contributor.trim() || !amount || isNaN(+amount) || +amount <= 0) {
      setError("Please enter a valid name and a positive amount.");
      return false;
    }
    return true;
  };

  const total = contributions
    .filter(c => c.status === 'success')
    .reduce((sum, c) => sum + (parseFloat(c.amount) || 0), 0);

  return (
    <BackgroundWrapper>
      <PageContainer title="CONTRIBUTIONS" userName={contributor}>
        <div className="flex flex-col gap-2 px-4 pb-4">
          <input
            type="text"
            placeholder="Contributor Name"
            className="rounded px-3 py-2 border"
            value={contributor}
            onChange={(e) => setContributor(e.target.value)}
            required
          />
          <input
            type="number"
            min="1"
            placeholder="Amount"
            className="rounded px-3 py-2 border"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            required
          />
          {error && <div className="text-red-500 text-sm text-center p-2 bg-red-100 rounded">{error}</div>}
          
          <div className="flex gap-2">
            <button onClick={handleAddContribution} disabled={loading} className="flex-1 bg-green-600 hover:bg-green-700 text-white font-bold py-2 rounded disabled:bg-gray-400">
              {loading ? "..." : "Add Cash"}
            </button>
            <button onClick={handlePayOnline} disabled={loading} className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 rounded disabled:bg-gray-400">
              {loading ? "..." : "Pay Online"}
            </button>
          </div>
        </div>

        <div className="text-center font-bold mb-2">
          Total Contribution: ₹{total.toFixed(2)}
        </div>

        <div className="grid grid-cols-2 gap-2 px-3 pb-8 mt-4">
          {contributions.map((c) => (
            <div key={c.id} className={`rounded shadow p-2 ${c.status === 'success' ? 'bg-green-100' : 'bg-yellow-100'}`}>
              <div className="font-semibold">{c.contributor}</div>
              <div>₹{c.amount}</div>
              <div className="text-xs capitalize">Status: {c.status}</div>
              
            </div>
          ))}
        </div>
      </PageContainer>
    </BackgroundWrapper>
  );
}
