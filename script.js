const AUTH_API_BASE = "https://bsky.social/xrpc";
let authSession = null; 
const API_BASE = "https://public.api.bsky.app/xrpc";

let currentHandle = "";
let currentCursor = null;
let currentProfile = null;
let isLoading = false;
let seenPosts = new Set();

function showToast(message, type = 'info') {
    const container = document.getElementById('toastContainer');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerText = message;

    container.appendChild(toast);

    setTimeout(() => {
        toast.style.animation = 'fadeOut 0.5s ease forwards';
        setTimeout(() => toast.remove(), 500);
    }, 3000);
}

async function loginUser() {
    const handle = document.getElementById('loginHandle').value.trim();
    const password = document.getElementById('loginPassword').value.trim();

    if (!handle || !password) {
        return showToast("Please enter both handle and App Password.", "error");
    }

    try {
        const res = await fetch(`${AUTH_API_BASE}/com.atproto.server.createSession`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ identifier: handle, password: password })
        });

        if (!res.ok) {
            const errorData = await res.json();
            throw new Error(errorData.message || "Login failed. Check your credentials.");
        }

        authSession = await res.json();

        document.getElementById('loginForm').classList.add('hidden');
        document.getElementById('loginStatus').classList.remove('hidden');
        document.getElementById('loggedInName').innerText = `@${authSession.handle}`;
        document.getElementById('postComposer').classList.remove('hidden');
        
        showToast("Logged in successfully!", "success");
        
        if (currentHandle) fetchUserData(currentHandle);

    } catch (err) {
        showToast(err.message, "error");
    }
}

function logoutUser() {
    authSession = null;
    document.getElementById('loginForm').classList.remove('hidden');
    document.getElementById('loginStatus').classList.add('hidden');
    document.getElementById('loginHandle').value = '';
    document.getElementById('loginPassword').value = '';
    document.getElementById('postComposer').classList.add('hidden');
    if (currentHandle) fetchUserData(currentHandle); 
}

const observer = new IntersectionObserver((entries) => {
    if (entries[0].isIntersecting && currentCursor && !isLoading) {
        fetchPosts(true); 
    }
}, { rootMargin: "100px" });

async function fetchUserData(forceHandle = null) {
    const handle = forceHandle || document.getElementById('handleInput').value.trim() || currentHandle;
    if (!handle) return showToast("Type a handle, genius!");

    document.getElementById('handleInput').value = handle;
    currentHandle = handle;
    currentCursor = null;
    seenPosts.clear();
    document.getElementById('feed').innerHTML = ''; 
    document.getElementById('videoFeed').innerHTML = ''; 
    switchTab('posts');
    
    try {
        const profileRes = await fetch(`${API_BASE}/app.bsky.actor.getProfile?actor=${handle}`);
        if (!profileRes.ok) throw new Error("User not found");
        
        currentProfile = await profileRes.json();
        await fetchPosts(false);
        
        const sentinel = document.getElementById('scrollSentinel');
        observer.observe(sentinel);
        
    } catch (err) {
        showToast(err.message);
        document.getElementById('profileCard').classList.add('hidden');
    }
}

async function fetchPosts(isPaginating = false) {
    if (!currentHandle) return;
    isLoading = true;
    
    const sentinel = document.getElementById('scrollSentinel');
    if (isPaginating) sentinel.classList.remove('hidden');

    const baseUrl = authSession ? AUTH_API_BASE : API_BASE;
    let url = `${baseUrl}/app.bsky.feed.getAuthorFeed?actor=${currentHandle}&limit=10`;
    
    if (currentCursor) {
        url += `&cursor=${currentCursor}`;
    }

    try {
        const headers = {};
        if (authSession) {
            headers['Authorization'] = `Bearer ${authSession.accessJwt}`;
        }

        const feedRes = await fetch(url, { headers });
        if (!feedRes.ok) throw new Error("Failed to fetch posts from the server.");
        
        const feedData = await feedRes.json();
        currentCursor = feedData.cursor || null;
        
        updateUI(currentProfile, feedData.feed);
        
        if (!currentCursor) {
            sentinel.innerHTML = 'No more posts to show. <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: middle; margin-left: 4px;"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>';
        }

    } catch (err) {
        console.error("Error fetching feed:", err);
    } finally {
        isLoading = false;
        if (!isPaginating && currentCursor) sentinel.classList.remove('hidden');
    }
} 

function updateUI(profile, posts) {
    document.getElementById('profileCard').classList.remove('hidden');
    
    document.getElementById('pfp').src = profile.avatar || 'https://via.placeholder.com/80';
    document.getElementById('displayName').innerText = profile.displayName || currentHandle;
    document.getElementById('handle').innerText = `@${profile.handle}`;
    document.getElementById('bio').innerText = profile.description || "No bio yet.";
    
    const formatter = new Intl.NumberFormat('en-US', { 
        notation: 'compact', 
        compactDisplay: 'short' 
    });
    
    document.getElementById('followers').innerText = formatter.format(profile.followersCount || 0);
    document.getElementById('following').innerText = formatter.format(profile.followsCount || 0);
    document.getElementById('postsCount').innerText = formatter.format(profile.postsCount || 0);

    const verifiedBadge = document.getElementById('verifiedBadge');
    const trustedBadge = document.getElementById('trustedBadge');

    verifiedBadge.classList.add('hidden');
    trustedBadge.classList.add('hidden');

    if (profile.verification) {
        if (profile.verification.verifiedStatus === 'valid') {
            verifiedBadge.classList.remove('hidden');
        }
        if (profile.verification.trustedVerifierStatus === 'valid') {
            trustedBadge.classList.remove('hidden');
        }
    } else if (profile.handle && !profile.handle.endsWith('.bsky.social')) {
        verifiedBadge.classList.remove('hidden');
    }

    const feedContainer = document.getElementById('feed');

    const clockSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>`;
    const heartEmptySvg = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/></svg>`;
    const heartFilledSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/></svg>`;
    const repostSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m17 2 4 4-4 4"/><path d="M3 11v-1a4 4 0 0 1 4-4h14"/><path d="m7 22-4-4 4-4"/><path d="M21 13v1a4 4 0 0 1-4 4H3"/></svg>`;
    const replySvg = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z"/></svg>`;
    const linkSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>`;
    const replyArrowSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 14 4 9 9 4"/><path d="M20 20v-7a4 4 0 0 0-4-4H4"/></svg>`;

    posts.forEach(item => {
        if (seenPosts.has(item.post.uri)) return; 
        seenPosts.add(item.post.uri);
        
        const uriParts = item.post.uri.split('/');
        const rkey = uriParts[uriParts.length - 1];
        const postUrl = `https://bsky.app/profile/${profile.did}/post/${rkey}`;

        const postDiv = document.createElement('div');
        postDiv.className = 'post';
        postDiv.id = `post-${rkey}`;

        const rawText = item.post.record.text || "[No text]";
        const isLongText = rawText.length > 150;

        const rawDate = item.post.record.createdAt || item.post.indexedAt;
        const formattedDate = rawDate ? new Date(rawDate).toLocaleString(undefined, {
            year: 'numeric', month: 'short', day: 'numeric',
            hour: '2-digit', minute: '2-digit'
        }) : "Unknown date";

        const likes = item.post.likeCount ?? 0;
        const reposts = item.post.repostCount ?? 0;
        const replies = item.post.replyCount ?? 0;

        const parentUri = item.post.uri;
        const parentCid = item.post.cid;
        const rootUri = item.post.record.reply ? item.post.record.reply.root.uri : parentUri;
        const rootCid = item.post.record.reply ? item.post.record.reply.root.cid : parentCid;

        const facets = item.post.record.facets || [];
        const richHtml = renderRichText(rawText, facets);

        let textContentHtml = '';
        if (isLongText) {
            textContentHtml = `
                <div class="post-text-container">
                    <div class="post-full clamped" id="text-${rkey}">${richHtml}</div>
                    <button class="read-more-btn" onclick="toggleTextClamped('text-${rkey}', this)">Read More</button>
                </div>
            `;
        } else {
            textContentHtml = `<div class="post-full">${richHtml}</div>`;
        }

        let likeButtonHtml = `${heartFilledSvg} <b>${likes}</b>`;
        if (authSession) {
            if (item.post.viewer && item.post.viewer.like) {
                const likeUriParts = item.post.viewer.like.split('/');
                const existingLikeRkey = likeUriParts[likeUriParts.length - 1];
                const originalLikes = Math.max(0, likes - 1); 
                likeButtonHtml = `
                    <button class="like-btn active-like" onclick="unlikePost('${item.post.uri}', '${item.post.cid}', '${rkey}', '${existingLikeRkey}', ${originalLikes})">
                        ${heartFilledSvg} <b>${likes}</b>
                    </button>`;
            } else {
                likeButtonHtml = `
                    <button class="like-btn" onclick="likePost('${item.post.uri}', '${item.post.cid}', '${rkey}', ${likes})">
                        ${heartEmptySvg} <b>${likes}</b>
                    </button>`;
            }
        }
        
        let repostButtonHtml = `<span class="repost-btn">${repostSvg} <b>${reposts}</b></span>`;
        if (authSession) {
            if (item.post.viewer && item.post.viewer.repost) {
                const repostUriParts = item.post.viewer.repost.split('/');
                const existingRepostRkey = repostUriParts[repostUriParts.length - 1];
                const originalReposts = Math.max(0, reposts - 1); 
                repostButtonHtml = `
                    <button class="repost-btn active-repost" onclick="unrepostPost('${item.post.uri}', '${item.post.cid}', '${rkey}', '${existingRepostRkey}', ${originalReposts})">
                        ${repostSvg} <b>${reposts}</b>
                    </button>`;
            } else {
                repostButtonHtml = `
                    <button class="repost-btn" onclick="repostPost('${item.post.uri}', '${item.post.cid}', '${rkey}', ${reposts})">
                        ${repostSvg} <b>${reposts}</b>
                    </button>`;
            }
        }

        let embedHtml = ''; 
        let videoDataToInit = null; 

        if (item.post.embed) {
            if (item.post.embed.$type === 'app.bsky.embed.images#view' || item.post.embed.images) {
                embedHtml = `<div class="post-gallery">`;
                item.post.embed.images.forEach(img => {
                    embedHtml += `<img src="${img.thumb}" class="post-img" alt="${img.alt || 'post image'}" onclick="openLightbox('${img.fullsize}')">`; 
                });
                embedHtml += `</div>`;
            } else if (item.post.embed.$type === 'app.bsky.embed.video#view') {
                const video = item.post.embed;
                const videoId = `bsky-video-${rkey}`;
                
                embedHtml = `
                    <div class="embed-card video-card">
                        <video id="${videoId}" class="post-video" controls poster="${video.thumbnail}" preload="none"></video>
                    </div>
                `;
                
                videoDataToInit = { id: videoId, playlist: video.playlist };

                const gridItem = document.createElement('a');
                gridItem.className = 'shot-item';
                gridItem.href = "#";
                gridItem.onclick = (e) => { 
                    e.preventDefault(); 
                    focusPost(rkey); 
                };
                gridItem.innerHTML = `
                    <img src="${video.thumbnail}" class="shot-thumbnail" alt="Video">
                    <div class="shot-overlay">
                        <svg viewBox="0 0 24 24" fill="white" width="32" height="32"><path d="M8 5v14l11-7z"/></svg>
                    </div>
                `;
                document.getElementById('videoFeed').appendChild(gridItem);

            } else if (item.post.embed.$type ===  'app.bsky.embed.external#view') {
                const ext = item.post.embed.external;
                const isGif = ext.uri.includes('tenor.com') || ext.uri.includes('giphy.com');

                if (isGif) {
                    const isVideoGif = ext.uri.endsWith('.mp4') || ext.uri.endsWith('.webm');
                    if (isVideoGif) {
                        embedHtml = `
                            <div class="embed-card video-card">
                                <video class="post-video" autoplay loop muted playsinline src="${ext.uri}" poster="${ext.thumb || ''}"></video>
                            </div>
                        `;
                    } else {
                        embedHtml = `
                            <div class="embed-card video-card">
                                <img src="${ext.uri}" class="post-video" alt="${escapeHTML(ext.title || 'GIF')}">
                            </div>
                        `;
                    }
                } else {
                    embedHtml = `
                        <a href="${ext.uri}" target="_blank" class="embed-card external-card">
                            ${ext.thumb ? `<img src="${ext.thumb}" class="embed-thumb" alt="Link thumbnail">` : ''}
                            <div class="embed-content">
                                <div class="embed-title">${escapeHTML(ext.title || 'Link')}</div>
                                <div class="embed-description">${escapeHTML(ext.description || '')}</div>
                                <div class="embed-uri">${linkSvg} ${new URL(ext.uri).hostname}</div>
                            </div>
                        </a>
                    `;
                }
            } else if (item.post.embed.$type === 'app.bsky.embed.record#view') {
                const record = item.post.embed.record;
                if (record.$type === 'app.bsky.embed.record#viewRecord') {
                    embedHtml = `
                        <div class="embed-card quote-card">
                            <div class="quote-header">
                                <img src="${record.author.avatar || 'https://via.placeholder.com/20'}" class="quote-avatar">
                                <span class="quote-author">
                                    <b>${escapeHTML(record.author.displayName || record.author.handle)}</b> 
                                    @${record.author.handle}
                                </span>
                            </div>
                            <p class="quote-text">${escapeHTML(record.value.text || '')}</p>
                        </div>
                    `;
                }
            }
        } 

        postDiv.innerHTML = `
            <div class="post-date">${clockSvg} ${formattedDate}</div> 
            <div class="post-preview">${textContentHtml}</div>
            ${embedHtml} 
            <div class="post-stats">
                <span class="stat-item" onclick="toggleAndLoadReplies('${item.post.uri}', '${rkey}')">${replySvg} <b>${replies}</b></span>
                <span class="stat-item" id="repost-container-${rkey}">${repostButtonHtml}</span>
                <span class="stat-item" id="like-container-${rkey}">${likeButtonHtml}</span>
            </div>
            <div class="post-actions">
                ${authSession ? `<button class="reply-toggle-btn" onclick="toggleReplyBox('${rkey}')">${replyArrowSvg} Reply</button>` : ''}
                <a href="${postUrl}" target="_blank" class="post-link">View Post →</a>
            </div>
            ${authSession ? `
            <div id="reply-container-${rkey}" class="reply-container hidden">
                <textarea id="reply-input-${rkey}" class="reply-input" placeholder="Post your reply..."></textarea>
                <button class="submit-reply-btn" onclick="submitReply('${parentUri}', '${parentCid}', '${rootUri}', '${rootCid}', '${rkey}')">Post Reply</button>
            </div>
            ` : ''}
            <div id="thread-container-${rkey}" class="thread-container hidden"></div>
        `;
        
        const downloadBtn = document.createElement('button');
        downloadBtn.className = 'download-btn';
        downloadBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg> JSON';
        downloadBtn.onclick = () => downloadPostJson(item.post);
        postDiv.querySelector('.post-actions').appendChild(downloadBtn);
        
        feedContainer.appendChild(postDiv);
        
        if (videoDataToInit) {
            const videoElement = document.getElementById(videoDataToInit.id);
            if (videoElement) {
                if (Hls.isSupported()) {
                    const hls = new Hls();
                    hls.loadSource(videoDataToInit.playlist);
                    hls.attachMedia(videoElement);
                }
                else if (videoElement.canPlayType('application/vnd.apple.mpegurl')) {
                    videoElement.src = videoDataToInit.playlist;
                }
            }
        }
    }); 
}

function downloadPostJson(postData) {
    const jsonString = JSON.stringify(postData, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", url);
    
    const fileId = postData.cid ? postData.cid.substring(0, 8) : 'unknown';
    downloadAnchorNode.setAttribute("download", `post_${fileId}.json`);
    
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
    URL.revokeObjectURL(url);
}

function showBadgePopup(event, text) {
    if (document.querySelector('.verified-popup')) return;
    const notification = document.createElement('span');
    notification.innerText = text;
    notification.className = 'verified-popup';
    event.currentTarget.parentElement.appendChild(notification);
    setTimeout(() => {
        notification.style.opacity = '0';
        setTimeout(() => notification.remove(), 300);
    }, 1500);
}

document.getElementById('verifiedBadge').addEventListener('click', (e) => showBadgePopup(e, 'Verified Account'));
document.getElementById('trustedBadge').addEventListener('click', (e) => showBadgePopup(e, 'Trusted Verifier'));

async function likePost(postUri, postCid, postRkey, currentLikes) {
    if (!authSession) return showToast("You must be logged in to like a post.");

    try {
        const res = await fetch(`${AUTH_API_BASE}/com.atproto.repo.createRecord`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authSession.accessJwt}` 
            },
            body: JSON.stringify({
                repo: authSession.did, 
                collection: "app.bsky.feed.like",
                record: {
                    $type: "app.bsky.feed.like",
                    subject: { uri: postUri, cid: postCid },
                    createdAt: new Date().toISOString()
                }
            })
        });

        if (!res.ok) {
            const errorData = await res.json();
            throw new Error(errorData.message || "Failed to like post");
        }

        const data = await res.json();
        const uriParts = data.uri.split('/');
        const likeRkey = uriParts[uriParts.length - 1];

        const container = document.getElementById(`like-container-${postRkey}`);
        container.innerHTML = `
            <button class="like-btn active-like" onclick="unlikePost('${postUri}', '${postCid}', '${postRkey}', '${likeRkey}', ${currentLikes})">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/></svg> <b>${currentLikes + 1}</b>
            </button>`;

    } catch (err) {
        console.error(err);
        showToast("Error liking post: " + err.message);
    }
}

async function unlikePost(postUri, postCid, postRkey, likeRkey, originalLikes) {
    if (!authSession) return showToast("You must be logged in to unlike a post.");

    try {
        const res = await fetch(`${AUTH_API_BASE}/com.atproto.repo.deleteRecord`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authSession.accessJwt}` 
            },
            body: JSON.stringify({
                repo: authSession.did,
                collection: "app.bsky.feed.like",
                rkey: likeRkey
            })
        });

        if (!res.ok) {
            const errorData = await res.json();
            throw new Error(errorData.message || "Failed to unlike post");
        }

        const container = document.getElementById(`like-container-${postRkey}`);
        container.innerHTML = `
            <button class="like-btn" onclick="likePost('${postUri}', '${postCid}', '${postRkey}', ${originalLikes})">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/></svg> <b>${originalLikes}</b>
            </button>`;

    } catch (err) {
        console.error(err);
        showToast("Error unliking post: " + err.message);
    }
}

function toggleReplyBox(rkey) {
    const box = document.getElementById(`reply-container-${rkey}`);
    box.classList.toggle('hidden');
}

async function submitReply(parentUri, parentCid, rootUri, rootCid, rkey) {
    if (!authSession) return showToast("You must be logged in to reply.", "error");

    const inputEl = document.getElementById(`reply-input-${rkey}`);
    const text = inputEl.value.trim();

    if (!text) return showToast("Reply cannot be empty!", "error");

    try {
        const generatedFacets = await parseFacets(text);

        const res = await fetch(`${AUTH_API_BASE}/com.atproto.repo.createRecord`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authSession.accessJwt}` 
            },
            body: JSON.stringify({
                repo: authSession.did, 
                collection: "app.bsky.feed.post",
                record: {
                    $type: "app.bsky.feed.post",
                    text: text,
                    createdAt: new Date().toISOString(),
                    ...(generatedFacets && { facets: generatedFacets }), 
                    reply: {
                        root: { uri: rootUri, cid: rootCid },
                        parent: { uri: parentUri, cid: parentCid }
                    }
                }
            })
        });

        if (!res.ok) {
            const errorData = await res.json();
            throw new Error(errorData.message || "Failed to post reply");
        }

        showToast("Reply posted successfully!", "success");
        inputEl.value = ""; 
        toggleReplyBox(rkey); 

    } catch (err) {
        console.error(err);
        showToast("Error posting reply: " + err.message, "error");
    }
}

async function submitPost() {
    if (!authSession) return showToast("You must be logged in to post.", "error");

    const inputEl = document.getElementById('new-post-input');
    const text = inputEl.value.trim();

    if (!text && pendingImages.length === 0 && !pendingExternalLink) {
        return showToast("Post cannot be completely empty!", "error");
    }

    try {
        const submitBtn = document.querySelector('.submit-reply-btn');
        submitBtn.innerText = "Posting...";
        submitBtn.disabled = true;

        const generatedFacets = await parseFacets(text);
        let postEmbed = undefined;

        if (pendingImages.length > 0) {
            const uploadedImages = [];
            for (const file of pendingImages) {
                const blobRef = await uploadBlob(file);
                uploadedImages.push({
                    alt: "Image uploaded via LycaClient",
                    image: blobRef
                });
            }
            postEmbed = {
                $type: "app.bsky.embed.images",
                images: uploadedImages
            };
        } 
        else if (pendingExternalLink) {
            postEmbed = {
                $type: "app.bsky.embed.external",
                external: {
                    uri: pendingExternalLink,
                    title: "External Link",
                    description: "Shared via LycaClient" 
                }
            };
        }

        const res = await fetch(`${AUTH_API_BASE}/com.atproto.repo.createRecord`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authSession.accessJwt}` 
            },
            body: JSON.stringify({
                repo: authSession.did, 
                collection: "app.bsky.feed.post",
                record: {
                    $type: "app.bsky.feed.post",
                    text: text,
                    createdAt: new Date().toISOString(),
                    ...(generatedFacets && { facets: generatedFacets }),
                    ...(postEmbed && { embed: postEmbed })
                }
            })
        });

        if (!res.ok) {
            const errorData = await res.json();
            throw new Error(errorData.message || "Failed to create post");
        }

        showToast("Post published successfully!", "success");
        
        inputEl.value = "";
        pendingImages = [];
        pendingExternalLink = null;
        renderMediaPreviews();
        document.getElementById('externalPreviewContainer').classList.add('hidden');
        
        if (currentHandle && currentHandle.toLowerCase() === authSession.handle.toLowerCase()) {
             fetchUserData(currentHandle);
        }

    } catch (err) {
        console.error(err);
        showToast("Error publishing post: " + err.message, "error");
    } finally {
        const submitBtn = document.querySelector('.submit-reply-btn');
        submitBtn.innerText = "Post";
        submitBtn.disabled = false;
    }
}

window.openLightbox = function(src) {
    const lb = document.getElementById('lightbox');
    const img = document.getElementById('lightboxImg');
    if (!lb || !img) return; 
    
    img.src = src;
    lb.classList.remove('hidden');
    document.body.style.overflow = 'hidden'; 
};

window.closeLightbox = function() {
    const lb = document.getElementById('lightbox');
    if (lb) {
        lb.classList.add('hidden');
        document.body.style.overflow = 'auto';
    }
};

async function toggleAndLoadReplies(postUri, rkey) {
    const container = document.getElementById(`thread-container-${rkey}`);

    if (!container.classList.contains('hidden')) {
        container.classList.add('hidden');
        return;
    }

    container.classList.remove('hidden');
    container.innerHTML = '<div class="loading-replies"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: middle; margin-right: 5px;"><path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z"/></svg> Loading replies...</div>';

    const baseUrl = authSession ? AUTH_API_BASE : API_BASE;
    const url = `${baseUrl}/app.bsky.feed.getPostThread?uri=${encodeURIComponent(postUri)}&depth=1`;

    try {
        const headers = {};
        if (authSession) {
            headers['Authorization'] = `Bearer ${authSession.accessJwt}`;
        }

        const res = await fetch(url, { headers });
        const data = await res.json();

        if (!data.thread || !data.thread.replies || data.thread.replies.length === 0) {
            container.innerHTML = '<div class="no-replies"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: middle; margin-right: 5px;"><polyline points="22 12 16 12 14 15 10 15 8 12 2 12"/><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/></svg> No replies yet.</div>';
            return;
        }

        let repliesHtml = '';
        
        data.thread.replies.forEach(replyNode => {
            const replyPost = replyNode.post;
            if (!replyPost) return;

            const author = replyPost.author;
            const text = replyPost.record.text || '[No text]';
            
            const date = replyPost.record.createdAt ? new Date(replyPost.record.createdAt).toLocaleString(undefined, {
                month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
            }) : 'Unknown date';

            repliesHtml += `
                <div class="reply-item">
                    <div class="reply-header">
                        <img src="${author.avatar || 'https://via.placeholder.com/30'}" class="reply-avatar">
                        <div class="reply-author-info">
                            <b>${author.displayName || author.handle}</b> <span class="reply-handle">@${author.handle}</span>
                            <div class="reply-date">${date}</div>
                        </div>
                    </div>
                    <p class="reply-text">${text}</p>
                </div>
            `;
        });

        container.innerHTML = repliesHtml;

    } catch (err) {
        console.error("Error loading replies:", err);
        container.innerHTML = '<div class="error-replies"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: middle; margin-right: 5px;"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg> Failed to load replies.</div>';
    }
}

function escapeHTML(str) {
    return str.replace(/[&<>'"]/g, 
        tag => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;',
            "'": '&#39;', '"': '&quot;'
        }[tag])
    );
}

function renderRichText(text, facets) {
    if (!text) return "";
    if (!facets || facets.length === 0) return escapeHTML(text).replace(/\n/g, '<br>');

    const encoder = new TextEncoder();
    const decoder = new TextDecoder();
    const bytes = encoder.encode(text);

    let html = '';
    let lastByte = 0;

    facets.sort((a, b) => a.index.byteStart - b.index.byteStart);

    for (const facet of facets) {
        if (facet.index.byteStart > lastByte) {
            const beforeBytes = bytes.slice(lastByte, facet.index.byteStart);
            html += escapeHTML(decoder.decode(beforeBytes));
        }

        const facetBytes = bytes.slice(facet.index.byteStart, facet.index.byteEnd);
        const facetText = escapeHTML(decoder.decode(facetBytes));

        const feature = facet.features[0];
        if (feature.$type === 'app.bsky.richtext.facet#mention') {
            html += `<a href="#" class="facet-link mention" onclick="document.getElementById('handleInput').value='${feature.did}'; fetchUserData(); return false;">${facetText}</a>`;
        } else if (feature.$type === 'app.bsky.richtext.facet#link') {
            html += `<a href="${feature.uri}" target="_blank" class="facet-link external">${facetText}</a>`;
        } else if (feature.$type === 'app.bsky.richtext.facet#tag') {
            html += `<a href="https://bsky.app/hashtag/${encodeURIComponent(feature.tag)}" target="_blank" class="facet-link tag">${facetText}</a>`;
        } else {
            html += facetText;
        }

        lastByte = facet.index.byteEnd;
    }

    if (lastByte < bytes.length) {
        const afterBytes = bytes.slice(lastByte);
        html += escapeHTML(decoder.decode(afterBytes));
    }

    return html.replace(/\n/g, '<br>'); 
}

function toggleTextClamped(elementId, btn) {
    const el = document.getElementById(elementId);
    if (el.classList.contains('clamped')) {
        el.classList.remove('clamped');
        btn.innerText = 'Show Less';
    } else {
        el.classList.add('clamped');
        btn.innerText = 'Read More';
    }
}
 
async function parseFacets(text) {
    const facets = [];
    const encoder = new TextEncoder();
    const getByteStart = (index) => encoder.encode(text.substring(0, index)).byteLength;

    const urlRegex = /(https?:\/\/[^\s]+)/g;
    let match;
    while ((match = urlRegex.exec(text)) !== null) {
        let uri = match[0];
        if (/[.,;!?]$/.test(uri)) uri = uri.slice(0, -1);
        
        const byteStart = getByteStart(match.index);
        const byteEnd = byteStart + encoder.encode(uri).byteLength;
        
        facets.push({
            index: { byteStart, byteEnd },
            features: [{ $type: 'app.bsky.richtext.facet#link', uri }]
        });
    }

    const tagRegex = /(?:^|\s)(#[^\s]+)/g; 
    while ((match = tagRegex.exec(text)) !== null) {
        let tagWithHash = match[1];
        tagWithHash = tagWithHash.replace(/[.,;!?]+$/, '');
        const tag = tagWithHash.substring(1); 
        const matchIndex = match[0].indexOf(tagWithHash) + match.index;
        
        const byteStart = getByteStart(matchIndex);
        const byteEnd = byteStart + encoder.encode(tagWithHash).byteLength;
        
        facets.push({
            index: { byteStart, byteEnd },
            features: [{ $type: 'app.bsky.richtext.facet#tag', tag }]
        });
    }

    const mentionRegex = /(?:^|\s)(@[a-zA-Z0-9.-]+)/g;
    while ((match = mentionRegex.exec(text)) !== null) {
        let mentionWithAt = match[1];
        mentionWithAt = mentionWithAt.replace(/[.,;!?]+$/, ''); 
        const handle = mentionWithAt.substring(1); 
        const matchIndex = match[0].indexOf(mentionWithAt) + match.index;
        
        const byteStart = getByteStart(matchIndex);
        const byteEnd = byteStart + encoder.encode(mentionWithAt).byteLength;
        
        try {
            const res = await fetch(`https://public.api.bsky.app/xrpc/com.atproto.identity.resolveHandle?handle=${handle}`);
            if (res.ok) {
                const data = await res.json();
                facets.push({
                    index: { byteStart, byteEnd },
                    features: [{ $type: 'app.bsky.richtext.facet#mention', did: data.did }]
                });
            }
        } catch (err) {
            console.warn(`Could not resolve mention for ${handle}`);
        }
    }

    return facets.length > 0 ? facets : undefined;
}

let pendingImages = []; 
let pendingExternalLink = null;

function handleMediaSelect(event) {
    const files = Array.from(event.target.files || []);
    
    if (pendingImages.length + files.length > 4) {
        showToast("You can only attach up to 4 images per post.", "error");
        return;
    }

    files.forEach(file => {
        if (file.size > 1000000) {
            showToast(`"${file.name}" is over 1MB. Please compress it.`, "error");
        } else {
            pendingImages.push(file);
        }
    });
    
    document.getElementById('mediaInput').value = "";
    renderMediaPreviews();
}

function renderMediaPreviews() {
    const container = document.getElementById('mediaPreviewContainer');
    container.innerHTML = '';
    
    if (pendingImages.length === 0) {
        container.classList.add('hidden');
        return;
    }
    
    container.classList.remove('hidden');
    pendingImages.forEach((file, index) => {
        const url = URL.createObjectURL(file);
        const div = document.createElement('div');
        div.className = 'preview-item';
        div.innerHTML = `
            <img src="${url}" alt="Preview">
            <button class="remove-media-btn" onclick="removePendingImage(${index})">×</button>
        `;
        container.appendChild(div);
    });
}

function removePendingImage(index) {
    pendingImages.splice(index, 1);
    renderMediaPreviews();
}

function addExternalLink() {
    const url = prompt("Enter a Link or Tenor GIF URL:");
    if (!url) return;

    try {
        new URL(url); 
        pendingExternalLink = url;
        
        const container = document.getElementById('externalPreviewContainer');
        document.getElementById('externalPreviewText').innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: middle; margin-right: 4px;"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg> ${url}`;
        container.classList.remove('hidden');
    } catch {
        showToast("Please enter a valid URL including https://", "error");
    }
}

function removeExternalLink() {
    pendingExternalLink = null;
    document.getElementById('externalPreviewContainer').classList.add('hidden');
}

async function uploadBlob(file) {
    const res = await fetch(`${AUTH_API_BASE}/com.atproto.repo.uploadBlob`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${authSession.accessJwt}`,
            'Content-Type': file.type
        },
        body: file 
    });

    if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Failed to upload image.");
    }
    
    const data = await res.json();
    return data.blob; 
}

async function repostPost(postUri, postCid, postRkey, currentReposts) {
    if (!authSession) return showToast("You must be logged in to repost.", "error");

    try {
        const res = await fetch(`${AUTH_API_BASE}/com.atproto.repo.createRecord`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authSession.accessJwt}` 
            },
            body: JSON.stringify({
                repo: authSession.did, 
                collection: "app.bsky.feed.repost",
                record: {
                    $type: "app.bsky.feed.repost",
                    subject: { uri: postUri, cid: postCid },
                    createdAt: new Date().toISOString()
                }
            })
        });

        if (!res.ok) {
            const errorData = await res.json();
            throw new Error(errorData.message || "Failed to repost");
        }

        const data = await res.json();
        const uriParts = data.uri.split('/');
        const repostRkey = uriParts[uriParts.length - 1];

        const container = document.getElementById(`repost-container-${postRkey}`);
        container.innerHTML = `
            <button class="repost-btn active-repost" onclick="unrepostPost('${postUri}', '${postCid}', '${postRkey}', '${repostRkey}', ${currentReposts})">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m17 2 4 4-4 4"/><path d="M3 11v-1a4 4 0 0 1 4-4h14"/><path d="m7 22-4-4 4-4"/><path d="M21 13v1a4 4 0 0 1-4 4H3"/></svg> <b>${currentReposts + 1}</b>
            </button>`;

        showToast("Reposted!", "success");

    } catch (err) {
        console.error(err);
        showToast("Error reposting: " + err.message, "error");
    }
}

async function unrepostPost(postUri, postCid, postRkey, repostRkey, originalReposts) {
    if (!authSession) return showToast("You must be logged in to undo a repost.", "error");

    try {
        const res = await fetch(`${AUTH_API_BASE}/com.atproto.repo.deleteRecord`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authSession.accessJwt}` 
            },
            body: JSON.stringify({
                repo: authSession.did,
                collection: "app.bsky.feed.repost",
                rkey: repostRkey
            })
        });

        if (!res.ok) {
            const errorData = await res.json();
            throw new Error(errorData.message || "Failed to undo repost");
        }

        const container = document.getElementById(`repost-container-${postRkey}`);
        container.innerHTML = `
            <button class="repost-btn" onclick="repostPost('${postUri}', '${postCid}', '${postRkey}', ${originalReposts})">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m17 2 4 4-4 4"/><path d="M3 11v-1a4 4 0 0 1 4-4h14"/><path d="m7 22-4-4 4-4"/><path d="M21 13v1a4 4 0 0 1-4 4H3"/></svg> <b>${originalReposts}</b>
            </button>`;

    } catch (err) {
        console.error(err);
        showToast("Error undoing repost: " + err.message, "error");
    }
}

window.switchTab = function(tab) {
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    
    if (tab === 'posts') {
        document.querySelector('.tab-btn[onclick="switchTab(\'posts\')"]').classList.add('active');
        document.getElementById('feed').classList.remove('hidden');
        document.getElementById('videoFeed').classList.add('hidden');
    } else {
        document.querySelector('.tab-btn[onclick="switchTab(\'videos\')"]').classList.add('active');
        document.getElementById('feed').classList.add('hidden');
        document.getElementById('videoFeed').classList.remove('hidden');
    }
};

window.focusPost = function(rkey) {
    switchTab('posts'); 
    const postEl = document.getElementById(`post-${rkey}`);
    if (postEl) {
        postEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
        postEl.classList.add('highlight-post');
        setTimeout(() => postEl.classList.remove('highlight-post'), 2000);
    }
};
 // --- AUTOCOMPLETE / TYPEAHEAD LOGIC ---
let searchTimeout = null;

document.addEventListener('DOMContentLoaded', () => {
    const handleInput = document.getElementById('handleInput');
    const suggestionsBox = document.getElementById('searchSuggestions');

    // Listen for typing in the search bar
    handleInput.addEventListener('input', (e) => {
        clearTimeout(searchTimeout);
        const query = e.target.value.trim();

        if (!query) {
            suggestionsBox.classList.add('hidden');
            return;
        }

        // Wait 300ms after the user stops typing to fetch results
        searchTimeout = setTimeout(() => {
            fetchSuggestions(query);
        }, 300);
    });

    // Hide dropdown if the user clicks anywhere else on the page
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.search-box-wrapper')) {
            suggestionsBox.classList.add('hidden');
        }
    });
});

async function fetchSuggestions(query) {
    try {
        // Bluesky's specific endpoint for quick autocomplete searches
        const url = `${API_BASE}/app.bsky.actor.searchActorsTypeahead?q=${encodeURIComponent(query)}&limit=5`;
        const res = await fetch(url);
        
        if (!res.ok) return;
        const data = await res.json();
        
        renderSuggestions(data.actors);
    } catch (err) {
        console.error("Error fetching suggestions:", err);
    }
}

function renderSuggestions(actors) {
    const suggestionsBox = document.getElementById('searchSuggestions');
    suggestionsBox.innerHTML = '';

    if (!actors || actors.length === 0) {
        suggestionsBox.classList.add('hidden');
        return;
    }

    actors.forEach(actor => {
        const item = document.createElement('div');
        item.className = 'suggestion-item';

        item.onclick = () => {
            document.getElementById('handleInput').value = actor.handle;
            suggestionsBox.classList.add('hidden');
            fetchUserData(); 
        };

        const avatarSrc = actor.avatar || 'https://via.placeholder.com/36';
        const displayName = escapeHTML(actor.displayName || actor.handle);
        const handle = escapeHTML(actor.handle);

        item.innerHTML = `
            <img src="${avatarSrc}" class="suggestion-avatar" alt="avatar">
            <div class="suggestion-info">
                <span class="suggestion-name">${displayName}</span>
                <span class="suggestion-handle">@${handle}</span>
            </div>
        `;
        suggestionsBox.appendChild(item);
    });

    suggestionsBox.classList.remove('hidden');
}