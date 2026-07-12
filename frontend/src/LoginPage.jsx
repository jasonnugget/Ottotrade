import { useRef, useState } from 'react';
import mascot from './assets/otto-mascot.png';
import { getSupabase, setRememberMe as persistRememberMe } from './supabase.js';
import './LoginPage.css';

export default function LoginPage({ onLogin }) {
  const [view, setView] = useState('login');
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState('');
  const [formNotice, setFormNotice] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [departureVector, setDepartureVector] = useState({ x: 900, y: -520 });
  const [inkOrigin, setInkOrigin] = useState({ x: 0, y: 0 });
  const mascotRef = useRef(null);

  // Otto swims off-screen trailing ink, then onLogin fires once the animation lands.
  function beginDeparture() {
    const rect = mascotRef.current?.getBoundingClientRect();
    if (rect) {
      setInkOrigin({ x: rect.left + rect.width / 2, y: rect.top + rect.height * 0.74 });
    }
    setDepartureVector({ x: window.innerWidth * 0.72, y: -window.innerHeight * 0.62 });
    setIsLoggingIn(true);
    window.setTimeout(onLogin, 2400);
  }

  const isSignUp = view === 'signup';
  const isForgotPassword = view === 'forgotPassword';
  const submitLabel = isForgotPassword ? 'Send reset link' : isSignUp ? 'Create account' : 'Enter OttoTrade';
  const heading = isForgotPassword
    ? ['Account recovery', 'Reset your password.', 'Enter your email and we’ll send reset instructions.']
    : isSignUp
      ? ['Start watching the ripples.', 'Create your account.', 'Join OttoTrade and make sense of the market’s next move.']
      : ['Market intelligence, made friendly.', 'Welcome back.', 'Sign in to watch the market’s next ripple unfold.'];

  function changeView(nextView) {
    setView(nextView);
    setFormError('');
    setFormNotice('');
  }

  async function handleLogin(event) {
    event.preventDefault();
    if (isLoggingIn || isSubmitting) return;

    const formData = new FormData(event.currentTarget);
    const email = String(formData.get('email') || '').trim();
    const password = String(formData.get('password') || '');

    if (!email) {
      setFormError('Please enter your email address.');
      return;
    }
    if (!email.includes('@')) {
      setFormError(`Please include an '@' in the email address. '${email}' is missing an '@'.`);
      return;
    }
    if (!/^\S+@\S+\.\S+$/.test(email)) {
      setFormError('Please enter an email address in the format name@example.com.');
      return;
    }
    if (!isForgotPassword && !password) {
      setFormError('Please enter your password.');
      return;
    }
    if (isSignUp && password.length < 6) {
      setFormError('Your password must be at least 6 characters long.');
      return;
    }
    if (isSignUp && password !== String(formData.get('confirmPassword') || '')) {
      setFormError('Your password and confirmation do not match.');
      return;
    }

    setFormError('');
    setFormNotice('');
    setIsSubmitting(true);

    try {
      const supabase = getSupabase();

      if (isForgotPassword) {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: window.location.origin,
        });
        if (error) throw error;
        setFormNotice('If an account exists for that email, reset instructions are on their way.');
        return;
      }

      if (isSignUp) {
        persistRememberMe(true);
        const { data, error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;

        // Email confirmation is off for this project, so signUp() always hands back a
        // live session — except when the email already has an account. Supabase won't
        // error on that (it avoids leaking which emails are registered); it signals it
        // by returning the existing user with an empty identities array instead.
        if (data.user && data.user.identities?.length === 0) {
          setFormError('An account with that email already exists. Try signing in instead.');
          return;
        }

        beginDeparture();
        return;
      }

      persistRememberMe(rememberMe);
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;

      beginDeparture();
    } catch (error) {
      setFormError(error.message || 'We could not complete that request. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main
      className={`login-page ${isLoggingIn ? 'login-page--departing' : ''}`}
      style={{
        '--swim-x': `${departureVector.x}px`,
        '--swim-y': `${departureVector.y}px`,
        '--ink-x': `${inkOrigin.x}px`,
        '--ink-y': `${inkOrigin.y}px`,
      }}
    >
      <div className="login-page__glow login-page__glow--one" />
      <div className="login-page__glow login-page__glow--two" />
      <div className="login-page__grid" />
      <div className="login-bubbles" aria-hidden="true">
        <span /><span /><span /><span /><span /><span />
      </div>
      <div className="ink-transition" aria-hidden="true">
        <span className="ink-bloom ink-bloom--one" />
        <span className="ink-bloom ink-bloom--two" />
        <span className="ink-bloom ink-bloom--three" />
        <span className="ink-drop ink-drop--one" />
        <span className="ink-drop ink-drop--two" />
        <span className="ink-drop ink-drop--three" />
        <span className="ink-flood" />
      </div>

      <section className="login-card" aria-labelledby="login-title">
        <div className="mascot-stage" aria-hidden="true">
          <span className="mascot-stage__orb mascot-stage__orb--left" />
          <span className="mascot-stage__orb mascot-stage__orb--right" />
          <div className="mascot-swimmer" ref={mascotRef}>
            <img className="mascot" src={mascot} alt="" />
          </div>
        </div>

        <div className="login-card__heading">
          <p className="login-card__eyebrow">{heading[0]}</p>
          <h1 id="login-title">{heading[1]}</h1>
          <p>{heading[2]}</p>
        </div>

        <form className="login-form" onSubmit={handleLogin} noValidate>
          <label>
            Email address
            <input
              type="email"
              name="email"
              placeholder="you@company.com"
              autoComplete="email"
              aria-invalid={Boolean(formError)}
              aria-describedby={formError || formNotice ? 'login-feedback' : undefined}
              disabled={isLoggingIn || isSubmitting}
              onInput={() => { setFormError(''); setFormNotice(''); }}
            />
          </label>
          {!isForgotPassword && <label>
            Password
            <input type="password" name="password" placeholder="••••••••" autoComplete={isSignUp ? 'new-password' : 'current-password'} disabled={isLoggingIn || isSubmitting} onInput={() => { setFormError(''); setFormNotice(''); }} />
          </label>}

          {isSignUp && <label>
            Confirm password
            <input type="password" name="confirmPassword" placeholder="••••••••" autoComplete="new-password" disabled={isSubmitting} onInput={() => { setFormError(''); setFormNotice(''); }} />
          </label>}

          <div className="login-form__feedback" id="login-feedback" aria-live="polite">
            {formError && <p className="login-form__error" role="alert">{formError}</p>}
            {formNotice && <p className="login-form__notice">{formNotice}</p>}
          </div>

          {!isForgotPassword && !isSignUp && <div className="login-form__options">
            <label className="login-form__check">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(event) => setRememberMe(event.target.checked)}
                disabled={isLoggingIn || isSubmitting}
              />{' '}
              <span>Remember me</span>
            </label>
            <a href="#forgot-password" onClick={(event) => { event.preventDefault(); changeView('forgotPassword'); }}>Forgot password?</a>
          </div>}

          <button className="login-form__submit" type="submit" disabled={isLoggingIn || isSubmitting}>
            {isLoggingIn ? 'Finding your current…' : isSubmitting ? 'One moment…' : submitLabel}
            <span aria-hidden="true">→</span>
          </button>
        </form>

        <p className="login-card__footer">
          {isForgotPassword || isSignUp
            ? <>Already have an account? <a href="#login" onClick={(event) => { event.preventDefault(); changeView('login'); }}>Sign in</a></>
            : <>New to OttoTrade? <a href="#create-account" onClick={(event) => { event.preventDefault(); changeView('signup'); }}>Create an account</a></>}
        </p>
      </section>
    </main>
  );
}
