import React, { useEffect, useState } from 'react';
import './ProfilePage.css';

const initialProfile = {
  name: 'Elena Rostova',
  username: 'elena_eats',
  email: 'elena.rostova@nutribot.com',
  role: 'Plant-Based Culinary Creator',
  joined: 'Joined Aug 2024',
  bio: 'Passionate about simple, high-protein vegan comfort food. Sharing weekly meal preps and fermented recipes.',
  avatar: 'https://i.pravatar.cc/240?img=47',
  dateOfBirth: '1998-06-12',
  gender: 'Female',
  cover: 'https://images.unsplash.com/photo-1540420773420-3366772f4999?auto=format&fit=crop&w=1500&q=85',
  followers: '1.4k',
  following: '382',
  recipes: '18',
};

const posts = [
  {
    title: 'Crispy Tofu with Lemongrass & Scallion Glaze',
    calories: '320 kcal',
    protein: '24g Protein',
    length: '03:45 video',
    tag: 'High Protein',
    image: 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?auto=format&fit=crop&w=1200&q=85',
    ingredients: ['Extra Firm Organic Tofu', 'Fresh Lemongrass', 'Coconut Aminos', 'Red Birdseye Chili'],
    likes: '142',
    comments: '48',
    saves: '9',
    views: '1.2k',
  },
  {
    title: 'The Ultimate Rainbow Quinoa Buddha Bowl',
    calories: '480 kcal',
    protein: '18g Protein',
    length: '14g Fiber',
    tag: 'Gut Health',
    image: 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?auto=format&fit=crop&w=1200&q=85',
    description: 'Layered with warm fluffy tri-color quinoa, spiced roasted chickpeas, sliced creamy Haas avocado, shredded purple cabbage, and an herbed tahini drizzle.',
    likes: '94',
    comments: '76',
    saves: '34',
  },
];

function Sidebar({ profile }) {
  return (
    <aside className="sidebar" aria-label="Main navigation">
      <section className="side-card mini-profile">
        <div className="mini-profile__person">
          <img className="avatar avatar--small" src={profile.avatar} alt="" />
          <div>
            <strong>{profile.name} <span className="verified">✓</span></strong>
            <span className="muted">@{profile.username}</span>
          </div>
        </div>
        <span className="creator-badge">Leaf Verified Creator</span>
        <div className="mini-stats">
          <div><strong>{profile.followers}</strong><span>Followers</span></div>
          <div><strong>{profile.recipes}</strong><span>Recipes</span></div>
        </div>
      </section>

      <nav className="side-card nav-list">
        <a href="#feed"><span>▤</span> Feed</a>
        <a href="#planner"><span>▦</span> Weekly Meal Planner</a>
        <a href="#map"><span>⌖</span> Nearby Vegan Map</a>
        <a href="#analytics"><span>▥</span> Analytics</a>
      </nav>
    </aside>
  );
}

function RecipePost({ post, index, profile }) {
  return (
    <article className="post-card">
      <header className="post-card__header">
        <div className="post-author">
          <img className="avatar avatar--post" src={profile.avatar} alt="" />
          <div><strong>{profile.name} <span className="verified">✓</span></strong><span className="muted">@{profile.username} · {index === 0 ? '2 days ago' : '5 days ago'}</span></div>
        </div>
        <button className="post-action" type="button" aria-label="Post options">···</button>
      </header>
      <h2>{post.title}</h2>
      <div className="food-tags">
        <span>{post.calories}</span><span className="tag-protein">● {post.protein}</span><span>{post.length}</span><span>{post.tag}</span>
      </div>
      <img className="post-image" src={post.image} alt={post.title} loading="lazy" />
      {post.ingredients ? (
        <div className="ingredients"><h3>Key ingredients</h3><div>{post.ingredients.map((item) => <span key={item}>{item}</span>)}</div></div>
      ) : <p className="post-description">{post.description} This bowl fulfills 65% of your daily micronutrient targets in a single serving.</p>}
      <footer className="post-stats">
        <span><b className="heart">♡</b> {post.likes}</span><span>▢ {post.comments}</span>
        {post.saves && <span>♧ {post.saves}</span>}
        {post.views && <span className="views">◉ {post.views} views</span>}
        {index === 1 && <a href="#nutrition">Full Nutritional Breakdown →</a>}
      </footer>
    </article>
  );
}

function RightRail() {
  return (
    <aside className="right-rail" aria-label="Creator highlights">
      <section className="side-card popular-card">
        <div className="rail-heading"><h2>Most Popular<br />Recipe</h2><span>☆<small>4.9</small></span></div>
        <div className="popular-image"><img src={posts[0].image} alt="Crispy tofu recipe" /><strong>Crispy Tofu with Lemongrass</strong><small>1,248 community cooks</small></div>
        <a className="rail-button" href="#analytics">View Recipe Analytics <span>▥</span></a>
      </section>
      <section className="side-card standards-card">
        <h2><span className="leaf-mark">✧</span> Creator Standards</h2>
        <p><b>Natural Lighting:</b> Shoot with daylight to accentuate fresh herbs and botanical textures.</p>
        <p><b>Precise Macro Data:</b> Validate plant protein grams with built-in USDA scanner.</p>
        <p><b>Zero-Waste Mindset:</b> Share compostable prep notes and scrap preservation methods.</p>
        <div className="standards-links"><a href="#about">About</a><a href="#guidelines">Guidelines</a><a href="#terms">Creator Terms</a><a href="#privacy">Privacy</a></div>
        <small>© 2025 NutriBot. Plant-Forward Collective.</small>
      </section>
    </aside>
  );
}

function ProfileEditDialog({ profile, onClose, onSave }) {
  const [form, setForm] = useState({ ...profile });

  useEffect(() => {
    function handleKeyDown(event) {
      if (event.key === 'Escape') onClose();
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  function updateField(event) {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
  }

  function handleSubmit(event) {
    event.preventDefault();
    onSave({
      ...form,
      name: form.name.trim(),
      username: form.username.trim().replace(/^@/, ''),
      email: form.email.trim(),
      avatar: form.avatar.trim(),
      bio: form.bio.trim(),
    });
  }

  return (
    <div className="dialog-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="edit-dialog" role="dialog" aria-modal="true" aria-labelledby="edit-profile-title">
        <header className="edit-dialog__header">
          <div><span className="dialog-eyebrow">YOUR ACCOUNT</span><h2 id="edit-profile-title">Edit profile</h2><p>Keep your creator details up to date.</p></div>
          <button className="dialog-close" type="button" onClick={onClose} aria-label="Close edit profile">×</button>
        </header>
        <form onSubmit={handleSubmit}>
          <div className="edit-form-grid">
            <label className="edit-field">Full name<input autoFocus name="name" value={form.name} onChange={updateField} maxLength={150} required /></label>
            <label className="edit-field">Username<div className="input-prefix"><span>@</span><input name="username" value={form.username} onChange={updateField} maxLength={50} required /></div></label>
            <label className="edit-field edit-field--wide">Email<input type="email" name="email" value={form.email} onChange={updateField} maxLength={255} required /></label>
            <label className="edit-field edit-field--wide">Profile photo URL<input type="url" name="avatar" value={form.avatar} onChange={updateField} maxLength={500} placeholder="https://example.com/photo.jpg" /></label>
            <label className="edit-field">Date of birth<input type="date" name="dateOfBirth" value={form.dateOfBirth} onChange={updateField} /></label>
            <label className="edit-field">Gender<select name="gender" value={form.gender} onChange={updateField}><option value="Female">Female</option><option value="Male">Male</option><option value="Other">Other</option></select></label>
            <label className="edit-field edit-field--wide">Bio<textarea name="bio" value={form.bio} onChange={updateField} maxLength={500} rows={4} placeholder="Tell people a little about yourself" /><span className="character-count">{form.bio.length}/500</span></label>
          </div>
          <footer className="edit-dialog__footer"><button className="cancel-edit" type="button" onClick={onClose}>Cancel</button><button className="save-edit" type="submit">Save changes</button></footer>
        </form>
      </section>
    </div>
  );
}

export default function ProfilePage() {
  const [profile, setProfile] = useState(initialProfile);
  const [isEditing, setIsEditing] = useState(false);

  return (
    <div className="profile-page">
      <header className="topbar">
        <a className="brand-mark" href="#home" aria-label="NutriBot home"><span>●</span><span>●</span><span>●</span><b>NutriBot</b></a>
        <div className="topbar__right"><span className="top-avatar">E</span><span>⌄</span><button type="button" aria-label="Settings">⚙</button></div>
      </header>

      <div className="page-shell">
        <div className="breadcrumb"><span>Creators Hub</span><b>›</b><strong>{profile.name}</strong><span className="profile-wall">Profile Wall</span><span className="live-pill"><i /> Live Creator Feed</span></div>

        <div className="layout-grid">
          <Sidebar profile={profile} />
          <main className="main-column">
            <section className="profile-card">
              <div className="cover-photo" style={{ backgroundImage: `url("${profile.cover}")` }} />
              <div className="profile-card__content">
                <div className="profile-controls"><img className="avatar avatar--hero" src={profile.avatar} alt={`${profile.name} profile`} /><span className="online-check">✓</span><button className="edit-button" type="button" onClick={() => setIsEditing(true)}>✎ Edit Profile</button><button className="new-recipe" type="button" disabled>＋ New Recipe</button></div>
                <h1>{profile.name} <span className="verified verified--large">✿</span></h1>
                <p className="profile-meta">@{profile.username} <span>•</span> {profile.role} <span>•</span> {profile.joined}</p>
                <p className="profile-bio">{profile.bio} <span aria-hidden="true">♧</span></p>
                <div className="profile-stats"><span><b>{profile.followers}</b> Followers</span><i>•</i><span><b>{profile.following}</b> Following</span><i>•</i><span><b>{profile.recipes}</b> Recipes Published</span></div>
              </div>
            </section>

            <nav className="profile-tabs" aria-label="Profile content tabs">
              <a className="active" href="#feed">My Recipes &amp; Blogs <b>14</b></a><a href="#videos">Cooking Videos <b>4</b></a><a href="#saved">Saved to Planner</a>
            </nav>
            <section className="post-list" id="feed" aria-label="Creator posts">
              {posts.map((post, index) => <RecipePost key={post.title} post={post} index={index} profile={profile} />)}
            </section>
          </main>
          <RightRail />
        </div>
      </div>
      {isEditing && <ProfileEditDialog profile={profile} onClose={() => setIsEditing(false)} onSave={(updatedProfile) => { setProfile(updatedProfile); setIsEditing(false); }} />}
    </div>
  );
}
