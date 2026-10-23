
import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';

import BlinkSocialLayout from './BlinkSocialLayout';

import {
  friendlyDate,
  socialApi,
  socialAvatar,
  type SocialPerson,
} from './blinkSocialApi';

type Secret = {
  id: string;
  prompt: string;
  options: string[];
  visibility: 'ANONYMOUS' | 'NAMED';
  createdAt: string;
  editedAt: string | null;
  revealAt: string;
  revealed: boolean;
  isMine: boolean;
  canEdit: boolean;
  author: SocialPerson | null;
  correctIndex: number | null;
  myGuess: number | null;
  myReward: number;
  guessCount: number;
  myReaction: string | null;
  reactionCounts: Record<string, number>;
};

type Props = {
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
  onBack: () => void;
  onHearts: () => void;
};

const reactions = [
  '🧡',
  '❤️',
  '😮',
  '😂',
  '👏',
];

const quickOptions = [
  'Absolutely',
  'Maybe',
  'Not at all',
];

const revealDelays = [
  1, 6, 12, 24, 48, 72, 168,
];

function newRevealAt(hours: number): string {
  const marginMs = hours === 168 ? -10000 : 10000;

  return new Date(
    Date.now() + hours * 3600000 + marginMs,
  ).toISOString();
}

export default function SecretsPage({
  theme,
  onToggleTheme,
  onBack,
  onHearts,
}: Props) {
  const [items, setItems] = useState<Secret[]>([]);
  const [points, setPoints] = useState(0);
  const [reward, setReward] = useState(10);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const [composing, setComposing] = useState(false);
  const [editingId, setEditingId] =
    useState<string | null>(null);

  const [prompt, setPrompt] = useState('');
  const [options, setOptions] = useState<string[]>([
    ...quickOptions,
  ]);

  const [correct, setCorrect] = useState(0);

  const [visibility, setVisibility] =
    useState<'ANONYMOUS' | 'NAMED'>(
      'ANONYMOUS',
    );

  const [delay, setDelay] = useState(24);
  const [changeRevealTime, setChangeRevealTime] =
    useState(false);

  const [tab, setTab] =
    useState<'all' | 'mine' | 'answered'>(
      'all',
    );

  const creatorRef = useRef<HTMLElement | null>(null);

  // Load Secrets and Blink Points.
  const refresh = useCallback(async () => {
    const [secrets, balance] = await Promise.all([
      socialApi<Secret[]>('/secrets'),

      socialApi<{
        points: number;
        correctGuessReward: number;
      }>('/secrets/points'),
    ]);

    setItems(secrets);
    setPoints(balance.points);
    setReward(balance.correctGuessReward);
  }, []);

  useEffect(() => {
    void refresh().catch(err => {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to load Secrets.',
      );
    });
  }, [refresh]);

  function resetEditor() {
    setEditingId(null);
    setComposing(false);
    setPrompt('');
    setOptions([...quickOptions]);
    setCorrect(0);
    setVisibility('ANONYMOUS');
    setDelay(24);
    setChangeRevealTime(false);
  }

  function scrollToEditor() {
    window.requestAnimationFrame(() => {
      creatorRef.current?.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      });
    });
  }

  function startCreate() {
    if (composing && !editingId) {
      resetEditor();
      return;
    }

    resetEditor();
    setComposing(true);
    setError('');
    setNotice('');
    scrollToEditor();
  }

  // NEW: Fill the existing form for editing.
  function startEdit(secret: Secret) {
    if (
      busy ||
      !secret.canEdit ||
      secret.correctIndex === null
    ) {
      return;
    }

    setEditingId(secret.id);
    setPrompt(secret.prompt);
    setOptions([...secret.options]);
    setCorrect(secret.correctIndex);
    setVisibility(secret.visibility);

    setChangeRevealTime(false);
    setDelay(24);
    setComposing(true);

    setError('');
    setNotice('');

    scrollToEditor();
  }

  async function action(
    doWork: () => Promise<unknown>,
    successMessage: string,
  ) {
    setBusy(true);
    setError('');
    setNotice('');

    try {
      await doWork();
      await refresh();
      setNotice(successMessage);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Something went wrong.',
      );
    } finally {
      setBusy(false);
    }
  }

  // NEW: Create or edit using the same form.
  async function submitSecret() {
    if (busy) return;

    setBusy(true);
    setError('');
    setNotice('');

    try {
      const payload = {
        prompt: prompt.trim(),

        options: options.map(option =>
          option.trim(),
        ),

        correctIndex: correct,
        visibility,

        ...(
          !editingId || changeRevealTime
            ? { revealAt: newRevealAt(delay) }
            : {}
        ),
      };

      if (editingId) {
        await socialApi(
          `/secrets/${editingId}`,
          'PATCH',
          payload,
        );
      } else {
        await socialApi(
          '/secrets',
          'POST',
          payload,
        );
      }

      await refresh();

      setNotice(
        editingId
          ? 'Secret updated successfully.'
          : 'Your Secret is live! Friends can now guess.',
      );

      resetEditor();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Could not save Secret.',
      );
    } finally {
      setBusy(false);
    }
  }

  const visible = items.filter(secret => {
    if (tab === 'mine') return secret.isMine;
    if (tab === 'answered') {
      return secret.myGuess !== null;
    }
    return true;
  });

  const invalidForm =
    prompt.trim().length < 5 ||
    options.some(option => !option.trim()) ||
    new Set(
      options.map(option =>
        option.trim().toLowerCase(),
      ),
    ).size !== options.length;

  return (
    <BlinkSocialLayout
      active="secrets"
      title="The Secret Side of Us."
      subtitle="Drop a curious question. Let friends guess. The truth arrives when the clock runs out."
      theme={theme}
      onToggleTheme={onToggleTheme}
      onBack={onBack}
      onSecrets={() => {}}
      onHearts={onHearts}
    >
      {/* Existing statistics */}
      <div className="bs-stats">
        <div className="bs-stat bs-stat-orange">
          <span>✦ YOUR BLINK POINTS</span>

          <strong>
            {points.toLocaleString()}{' '}
            <small>BP</small>
          </strong>

          <small>
            +{reward} BP for each correct reveal
          </small>
        </div>

        <div className="bs-stat">
          <span>SECRETS IN YOUR CIRCLE</span>
          <strong>{items.length}</strong>

          <small>
            Created by you and your friends
          </small>
        </div>

        <div className="bs-stat">
          <span>AWAITING REVEAL</span>

          <strong>
            {items.filter(s => !s.revealed).length}
          </strong>

          <small>
            Answers unlock automatically
          </small>
        </div>
      </div>

      {/* Section heading */}
      <div className="bs-sectionbar">
        <div>
          <h2>🔐 Blink Secrets</h2>
          <p>
            A little mystery makes everything better.
          </p>
        </div>

        <button
          type="button"
          className="bs-primary"
          onClick={startCreate}
        >
          {composing && !editingId
            ? 'Close creator'
            : '+ Create a Secret'}
        </button>
      </div>

      {error && (
        <div className="bs-alert" role="alert">
          {error}
        </div>
      )}

      {notice && (
        <div className="bs-notice" role="status">
          {notice}
        </div>
      )}

      {/* Create and edit form */}
      {composing && (
        <section
          className="bs-panel bs-creator"
          ref={creatorRef}
        >
          <div className="bs-label">
            {editingId
              ? 'EDIT YOUR SECRET'
              : 'NEW SECRET'}
          </div>

          <h3>
            {editingId
              ? 'Update your guessing game'
              : 'Create your guessing game'}
          </h3>

          {editingId && (
            <p className="bs-edit-hint">
              You can edit this Secret before its
              reveal, as long as nobody has guessed.
            </p>
          )}

          <label className="bs-field">
            Secret question

            <textarea
              rows={3}
              maxLength={500}
              value={prompt}
              placeholder="There's something I've always wanted to tell you…"
              onChange={event =>
                setPrompt(event.target.value)
              }
            />
          </label>

          <div className="bs-field">
            <span>
              Possible answers{' '}
              <small>
                · select the correct one
              </small>
            </span>

            {options.map((option, index) => (
              <div
                key={index}
                className="bs-option-edit"
              >
                <input
                  type="radio"
                  name="correct-answer"
                  checked={correct === index}
                  onChange={() =>
                    setCorrect(index)
                  }
                  title="Mark correct"
                />

                <input
                  type="text"
                  maxLength={120}
                  value={option}
                  placeholder={`Answer ${index + 1}`}
                  onChange={event => {
                    setOptions(current =>
                      current.map(
                        (value, i) =>
                          i === index
                            ? event.target.value
                            : value,
                      ),
                    );
                  }}
                />

                {options.length > 2 && (
                  <button
                    type="button"
                    title="Remove option"
                    aria-label={
                      `Remove answer ${index + 1}`
                    }
                    onClick={() => {
                      setOptions(current =>
                        current.filter(
                          (_, i) => i !== index,
                        ),
                      );

                      setCorrect(current =>
                        current === index
                          ? 0
                          : current > index
                            ? current - 1
                            : current,
                      );
                    }}
                  >
                    ×
                  </button>
                )}
              </div>
            ))}

            {options.length < 5 && (
              <button
                type="button"
                className="bs-text-btn"
                onClick={() =>
                  setOptions(current => [
                    ...current,
                    '',
                  ])
                }
              >
                + Add answer option
              </button>
            )}
          </div>

          <div className="bs-form-row">
            <label className="bs-field">
              Post as

              <select
                value={visibility}
                onChange={event =>
                  setVisibility(
                    event.target.value as
                      'ANONYMOUS' | 'NAMED',
                  )
                }
              >
                <option value="ANONYMOUS">
                  🔐 Anonymous
                </option>

                <option value="NAMED">
                  👤 With my Blink name
                </option>
              </select>
            </label>

            <div className="bs-field">
              <span>
                {editingId
                  ? 'Reveal time'
                  : 'Reveal answer after'}
              </span>

              {editingId && (
                <label className="bs-edit-check">
                  <input
                    type="checkbox"
                    checked={changeRevealTime}
                    onChange={event =>
                      setChangeRevealTime(
                        event.target.checked,
                      )
                    }
                  />

                  Set a new reveal time
                </label>
              )}

              {!editingId || changeRevealTime ? (
                <select
                  value={delay}
                  onChange={event =>
                    setDelay(
                      Number(event.target.value),
                    )
                  }
                >
                  {revealDelays.map(hours => (
                    <option
                      key={hours}
                      value={hours}
                    >
                      {hours < 24
                        ? `${hours} hour${hours > 1 ? 's' : ''}`
                        : `${hours / 24} day${hours > 24 ? 's' : ''}`}
                    </option>
                  ))}
                </select>
              ) : (
                <span className="bs-edit-hint">
                  Keep the currently scheduled reveal
                </span>
              )}
            </div>
          </div>

          <div className="bs-form-actions">
            <button
              type="button"
              className="bs-primary"
              disabled={busy || invalidForm}
              onClick={() =>
                void submitSecret()
              }
            >
              {busy
                ? 'Saving…'
                : editingId
                  ? 'Save changes →'
                  : 'Publish Secret →'}
            </button>

            <button
              type="button"
              className="bs-secondary"
              disabled={busy}
              onClick={resetEditor}
            >
              Cancel
            </button>
          </div>
        </section>
      )}

      {/* Secret feed tabs */}
      <div className="bs-tabs">
        <button
          type="button"
          className={tab === 'all' ? 'active' : ''}
          onClick={() => setTab('all')}
        >
          From your circle
        </button>

        <button
          type="button"
          className={tab === 'mine' ? 'active' : ''}
          onClick={() => setTab('mine')}
        >
          My secrets
        </button>

        <button
          type="button"
          className={
            tab === 'answered' ? 'active' : ''
          }
          onClick={() => setTab('answered')}
        >
          Answered
        </button>

        <button
          type="button"
          className="bs-refresh"
          onClick={() =>
            void refresh().catch(err =>
              setError(
                err instanceof Error
                  ? err.message
                  : 'Refresh failed.',
              ),
            )
          }
        >
          ↻ Refresh
        </button>
      </div>

      {/* Original Secret cards */}
      <div className="bs-secret-grid">
        {visible.length === 0 && (
          <div className="bs-empty">
            <span>✦</span>
            <strong>Nothing here yet</strong>

            <p>
              Create a Secret or invite friends
              to start a conversation.
            </p>
          </div>
        )}

        {visible.map(secret => (
          <article
            key={secret.id}
            className="bs-panel bs-secret-card"
          >
            <div className="bs-secret-meta">
              <span className="bs-avatar">
                {secret.author?.avatarKey ? (
                  <img
                    src={
                      socialAvatar(
                        secret.author.avatarKey,
                      ) || ''
                    }
                    alt=""
                  />
                ) : (
                  '🔐'
                )}
              </span>

              <span>
                <strong>
                  {secret.author?.name ||
                    'Anonymous Blink'}
                </strong>

                <small>
                  {friendlyDate(secret.createdAt)}
                  {secret.editedAt
                    ? ' · edited'
                    : ''}
                </small>
              </span>

              <span
                className={
                  `bs-chip ${
                    secret.revealed ? 'done' : ''
                  }`
                }
              >
                {secret.revealed
                  ? '✦ Revealed'
                  : '◷ Locked'}
              </span>
            </div>

            <h3>{secret.prompt}</h3>

            {/* NEW: Edit owned Secret */}
            {secret.canEdit && (
              <button
                type="button"
                className="bs-secondary bs-card-edit"
                disabled={busy}
                onClick={() =>
                  startEdit(secret)
                }
              >
                ✎ Edit Secret
              </button>
            )}

            {secret.isMine &&
              !secret.canEdit && (
                <p className="bs-edit-hint">
                  🔒 Editing locked after a
                  guess or reveal.
                </p>
              )}

            <div className="bs-answers">
              {secret.options.map(
                (option, index) => {
                  const chosen =
                    secret.myGuess === index;

                  const isCorrect =
                    secret.revealed &&
                    secret.correctIndex === index;

                  return (
                    <button
                      key={index}
                      type="button"
                      disabled={
                        busy ||
                        secret.isMine ||
                        secret.myGuess !== null ||
                        secret.revealed
                      }
                      className={
                        `bs-answer ${
                          chosen ? 'chosen' : ''
                        } ${
                          isCorrect ? 'correct' : ''
                        }`
                      }
                      onClick={() =>
                        void action(
                          () => socialApi(
                            `/secrets/${secret.id}/guess`,
                            'POST',
                            { selectedIndex: index },
                          ),
                          'Answer locked. Come back at reveal time!',
                        )
                      }
                    >
                      <span>
                        {String.fromCharCode(
                          65 + index,
                        )}
                      </span>

                      {option}

                      {chosen && (
                        <b>✓ Your guess</b>
                      )}

                      {isCorrect && (
                        <b>✓ Truth</b>
                      )}
                    </button>
                  );
                },
              )}
            </div>

            <div className="bs-secret-foot">
              <span>
                ◷{' '}
                {secret.revealed
                  ? 'Answer revealed'
                  : `Reveal ${friendlyDate(secret.revealAt)}`}
              </span>

              <span>
                ◎ {secret.guessCount} guesses
              </span>
            </div>

            {secret.revealed &&
              secret.myGuess !== null && (
                <p
                  className={
                    secret.myReward
                      ? 'bs-win'
                      : 'bs-result'
                  }
                >
                  {secret.myReward
                    ? `✦ Correct! +${secret.myReward} BP`
                    : 'The truth is out. Try another one!'}
                </p>
              )}

            <div className="bs-reactions">
              {reactions.map(emoji => (
                <button
                  key={emoji}
                  type="button"
                  title={`React ${emoji}`}
                  className={
                    secret.myReaction === emoji
                      ? 'active'
                      : ''
                  }
                  disabled={busy}
                  onClick={() =>
                    void action(
                      () => socialApi(
                        `/secrets/${secret.id}/react`,
                        'POST',
                        { emoji },
                      ),
                      'Reaction sent!',
                    )
                  }
                >
                  {emoji}{' '}
                  <small>
                    {secret.reactionCounts[emoji] ?? 0}
                  </small>
                </button>
              ))}
            </div>
          </article>
        ))}
      </div>
    </BlinkSocialLayout>
  );
}
