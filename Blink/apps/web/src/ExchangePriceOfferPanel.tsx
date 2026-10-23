
import {
  useCallback,
  useEffect,
  useState,
  type FormEvent,
} from 'react';

import './ExchangePriceOfferPanel.css';

const API_URL = (import.meta.env.VITE_API_URL || 'http://localhost:3000').replace(/\/$/, '');

const currencies = [
  { code: 'BDT', label: 'BDT — Bangladeshi Taka' },
  { code: 'USD', label: 'USD — US Dollar' },
  { code: 'EUR', label: 'EUR — Euro' },
  { code: 'GBP', label: 'GBP — British Pound' },
  { code: 'INR', label: 'INR — Indian Rupee' },
  { code: 'AED', label: 'AED — UAE Dirham' },
  { code: 'SAR', label: 'SAR — Saudi Riyal' },
  { code: 'CAD', label: 'CAD — Canadian Dollar' },
  { code: 'AUD', label: 'AUD — Australian Dollar' },
  { code: 'SGD', label: 'SGD — Singapore Dollar' },
];

type PriceOffer = {
  id: string;
  threadId: string;
  amount: string | number;
  currency: string;
  status: 'PENDING' | 'ACCEPTED' | 'DECLINED';
  createdAt: string;
  updatedAt: string;
  decidedAt: string | null;
};

type Props = {
  postId: string;
  threadId: string;
  isOwner: boolean;
  postStatus: 'OPEN' | 'CLOSED';
};

function readToken(): string | null {
  try {
    return (
      localStorage.getItem('blink-access-token') ||
      sessionStorage.getItem('blink-access-token')
    );
  } catch {
    return null;
  }
}


async function api<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const token = readToken();

  if (!token) {
    throw new Error('Please sign in again.');
  }

  const headers = new Headers(options.headers);

  headers.set('Authorization', `Bearer ${token}`);
  headers.set('Accept', 'application/json');

  if (options.body && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }

  let response: Response;

  try {
    response = await fetch(`${API_URL}${path}`, {
      ...options,
      headers,
      cache: 'no-store',
    });
  } catch {
    throw new Error(
      'Cannot connect to Blink API. Check that NestJS is running.',
    );
  }

  // Read the body only once.
  const raw = await response.text();

  let data: unknown = null;

  if (raw.trim()) {
    try {
      data = JSON.parse(raw);
    } catch {
      if (response.ok) {
        throw new Error(
          `The API returned invalid JSON (${response.status}).`,
        );
      }
    }
  }

  if (!response.ok) {
    const result = data as {
      message?: string | string[];
    } | null;

    const message = Array.isArray(result?.message)
      ? result.message.join(', ')
      : result?.message;

    throw new Error(
      message ||
        raw.slice(0, 250) ||
        `API request failed (${response.status})`,
    );
  }

  // GET /offer may legitimately return JSON null
  // when nobody has submitted an offer yet.
  if (options.method === undefined || options.method === 'GET') {
    return data as T;
  }

  // Mutations need a returned offer because the UI uses
  // its id, amount, currency, and status immediately.
  if (data === null) {
    throw new Error(
      'The API returned an empty response. Check the NestJS controller return value.',
    );
  }

  return data as T;
}


function formattedAmount(value: string | number): string {
  const [whole, fraction = ''] = String(value).split('.');

  const grouped = whole.replace(
    /\B(?=(\d{3})+(?!\d))/g,
    ',',
  );

  return `${grouped}.${fraction.padEnd(2, '0').slice(0, 2)}`;
}

export default function ExchangePriceOfferPanel({
  postId,
  threadId,
  isOwner,
  postStatus,
}: Props) {
  const [offer, setOffer] = useState<PriceOffer | null>(null);

  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState('BDT');

  const [formOpen, setFormOpen] = useState(false);
  const [expanded, setExpanded] = useState(true);

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const endpoint =
    `/exchange/${encodeURIComponent(postId)}` +
    `/chats/${encodeURIComponent(threadId)}/offer`;

  const refresh = useCallback(async () => {
    return api<PriceOffer | null>(endpoint);
  }, [endpoint]);

  // Load current offer and keep its status synchronized
  // between the customer's and provider's screens.
  useEffect(() => {
    let active = true;

    setOffer(null);
    setAmount('');
    setCurrency('BDT');
    setFormOpen(false);
    setLoading(true);
    setError('');

    async function load() {
      try {
        const data = await refresh();

        if (active) {
          setOffer(data);
          setError('');
        }
      } catch (loadError) {
        if (active) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : 'Could not load the price offer.',
          );
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void load();

    const timer = window.setInterval(() => {
      void load();
    }, 5000);

    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [refresh]);

  function openOfferForm() {
    if (offer) {
      setAmount(String(offer.amount));
      setCurrency(offer.currency);
    } else {
      setAmount('');
      setCurrency('BDT');
    }

    setError('');
    setFormOpen(true);
    setExpanded(true);
  }

  async function submitOffer(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    if (busy || isOwner) return;

    if (
      !/^(?:0|[1-9]\d{0,15})(?:\.\d{1,2})?$/.test(amount.trim()) ||
      !Number.isFinite(Number(amount)) ||
      Number(amount) <= 0
    ) {
      setError('Enter a valid amount greater than zero.');
      return;
    }

    setBusy(true);
    setError('');

    try {
      const data = await api<PriceOffer>(endpoint, {
        method: offer ? 'PATCH' : 'POST',
        body: JSON.stringify({
          amount: amount.trim(),
          currency,
        }),
      });

      setOffer(data);
      setFormOpen(false);
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : 'Could not submit the price offer.',
      );
    } finally {
      setBusy(false);
    }
  }

  async function decide(action: 'accept' | 'decline') {
    if (!isOwner || busy) return;

    const confirmation =
      action === 'accept'
        ? 'Accept this price offer? The decision cannot be changed.'
        : 'Decline this price offer? The decision cannot be changed.';

    if (!window.confirm(confirmation)) {
      return;
    }

    setBusy(true);
    setError('');

    try {
      const result = await api<PriceOffer>(
        `${endpoint}/${action}`,
        {
          method: 'POST',
        },
      );

      setOffer(result);
    } catch (decisionError) {
      setError(
        decisionError instanceof Error
          ? decisionError.message
          : 'Could not update the offer.',
      );

      // Refresh after a conflict: another action may have
      // changed the status on the server.
      try {
        setOffer(await refresh());
      } catch {
        // Keep original error message.
      }
    } finally {
      setBusy(false);
    }
  }

  const pending = offer?.status === 'PENDING';
  const canEdit = !isOwner && postStatus === 'OPEN' && pending;
  const canCreate = !isOwner && postStatus === 'OPEN' && !offer;

  return (
    <section className="blink-price-offer">
      <button
        type="button"
        className="blink-offer-heading"
        onClick={() => setExpanded((value) => !value)}
        aria-expanded={expanded}
      >
        <span className="blink-offer-heading-title">
          <span className="blink-offer-icon">◇</span>
          <span>Service price offer</span>
        </span>

        <span className="blink-offer-heading-right">
          {offer && (
            <span
              className={`blink-offer-status ${offer.status.toLowerCase()}`}
            >
              {offer.status}
            </span>
          )}
          <span className="blink-offer-chevron">
            {expanded ? '⌃' : '⌄'}
          </span>
        </span>
      </button>

      {expanded && (
        <div className="blink-offer-content">
          {loading ? (
            <p className="blink-offer-muted">
              Loading offer…
            </p>
          ) : (
            <>
              {offer ? (
                <div className="blink-offer-summary">
                  <div>
                    <small>OFFERED PRICE</small>

                    <div className="blink-offer-price">
                      <strong>
                        {formattedAmount(offer.amount)}
                      </strong>
                      <span>{offer.currency}</span>
                    </div>
                  </div>

                  {offer.status === 'PENDING' && (
                    <p>
                      Awaiting the service provider's decision.
                    </p>
                  )}

                  {offer.status === 'ACCEPTED' && (
                    <p className="blink-offer-accepted-text">
                      ✓ The provider accepted this offer.
                    </p>
                  )}

                  {offer.status === 'DECLINED' && (
                    <p className="blink-offer-declined-text">
                      The provider declined this offer.
                      You can continue discussing it in chat.
                    </p>
                  )}
                </div>
              ) : (
                <p className="blink-offer-muted">
                  {isOwner
                    ? 'Waiting for the interested customer to submit a price.'
                    : postStatus === 'CLOSED'
                      ? 'This exchange is closed to new offers.'
                      : 'Interested in this service? Send the provider your price offer.'}
                </p>
              )}

              {offer?.status === 'PENDING' && isOwner && (
                <div className="blink-offer-actions">
                  <button
                    type="button"
                    className="blink-offer-decline"
                    disabled={busy}
                    onClick={() => void decide('decline')}
                  >
                    Decline
                  </button>

                  <button
                    type="button"
                    className="blink-offer-accept"
                    disabled={busy}
                    onClick={() => void decide('accept')}
                  >
                    {busy ? 'Processing…' : 'Accept offer'}
                  </button>
                </div>
              )}

              {!formOpen && (canCreate || canEdit) && (
                <button
                  type="button"
                  className="blink-offer-edit"
                  disabled={busy}
                  onClick={openOfferForm}
                >
                  {offer
                    ? '✎ Change price or currency'
                    : '+ Make a price offer'}
                </button>
              )}

              {formOpen && (canCreate || canEdit) && (
                <form
                  className="blink-offer-form"
                  onSubmit={submitOffer}
                >
                  <div className="blink-offer-form-grid">
                    <label>
                      <span>YOUR PRICE</span>

                      <input
                        type="text"
                        inputMode="decimal"
                        placeholder="e.g. 1500.00"
                        value={amount}
                        maxLength={19}
                        required
                        onChange={(event) =>
                          setAmount(event.target.value)
                        }
                      />
                    </label>

                    <label>
                      <span>CURRENCY</span>

                      <select
                        value={currency}
                        onChange={(event) =>
                          setCurrency(event.target.value)
                        }
                      >
                        {currencies.map((item) => (
                          <option
                            key={item.code}
                            value={item.code}
                          >
                            {item.label}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>

                  <p className="blink-offer-note">
                    The amount is offered in the selected
                    currency. It is not converted automatically.
                  </p>

                  <div className="blink-offer-actions">
                    <button
                      type="button"
                      className="blink-offer-decline"
                      onClick={() => setFormOpen(false)}
                      disabled={busy}
                    >
                      Cancel
                    </button>

                    <button
                      type="submit"
                      className="blink-offer-accept"
                      disabled={busy || !amount.trim()}
                    >
                      {busy
                        ? 'Saving…'
                        : offer
                          ? 'Update offer'
                          : 'Send price offer'}
                    </button>
                  </div>
                </form>
              )}
            </>
          )}

          {error && (
            <p
              className="blink-offer-error"
              role="alert"
            >
              {error}
            </p>
          )}
        </div>
      )}
    </section>
  );
}
