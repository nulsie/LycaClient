var A_API="https://bsky.social/xrpc", P_API="https://public.api.bsky.app/xrpc", sess=null, curHandle="", curCursor=null, curProfile=null, isLdg=!1;

function ajax(m,u,h,b,ok,err){
    var x=new XMLHttpRequest(); x.open(m,u,!0);
    if(h) for(var k in h) x.setRequestHeader(k,h[k]);
    x.onreadystatechange=function(){
        if(x.readyState===4){
            var r; try{ r=JSON.parse(x.responseText); }catch(e){ r={message:"Invalid JSON"}; }
            if(x.status>=200&&x.status<300){ if(ok)ok(r); }else{ if(err)err(new Error(r.message||"Error")); }
        }
    };
    if(b){ x.setRequestHeader('Content-Type','application/json'); x.send(JSON.stringify(b)); } else x.send();
}

function toast(m){
    var c=document.getElementById('toastContainer'), t=document.createElement('div');
    t.className='toast'; t.innerHTML=m; c.appendChild(t);
    setTimeout(function(){ t.parentNode.removeChild(t); },3000);
}

function fmtNum(n){ return !n?"0":n>=1e3?(n/1e3).toFixed(1)+"k":n.toString(); }

function loginUser(){
    var h=document.getElementById('loginHandle').value, p=document.getElementById('loginPassword').value;
    if(!h||!p) return toast("Enter handle and password.");
    ajax('POST',A_API+'/com.atproto.server.createSession',null,{identifier:h,password:p},function(r){
        sess=r; 
        document.getElementById('loginForm').className='hidden';
        document.getElementById('loginStatus').className='';
        document.getElementById('loggedInName').innerHTML='@'+sess.handle;
        document.getElementById('postComposer').className='card';
        toast("Logged in!"); if(curHandle) fetchUserData();
    },function(e){ toast(e.message); });
}

function logoutUser(){
    sess=null; 
    document.getElementById('loginForm').className='';
    document.getElementById('loginStatus').className='hidden';
    document.getElementById('postComposer').className='card hidden';
    if(curHandle) fetchUserData();
}

function fetchUserData(){
    var h=document.getElementById('handleInput').value; if(!h) return toast("Type a handle!");
    curHandle=h; curCursor=null; document.getElementById('feed').innerHTML=''; 
    ajax('GET',P_API+'/app.bsky.actor.getProfile?actor='+encodeURIComponent(h),null,null,function(p){
        curProfile=p; fetchPosts(!1);
    },function(e){ toast("User not found."); });
}

function fetchPosts(pag){
    if(!curHandle||isLdg) return; isLdg=!0;
    var u=(sess?A_API:P_API)+'/app.bsky.feed.getAuthorFeed?actor='+encodeURIComponent(curHandle)+'&limit=10';
    if(curCursor) u+='&cursor='+encodeURIComponent(curCursor);
    ajax('GET',u,sess?{'Authorization':'Bearer '+sess.accessJwt}:null,null,function(d){
        curCursor=d.cursor||null; updateUI(curProfile,d.feed,pag);
        document.getElementById('loadMoreBtn').className=curCursor?'':'hidden'; isLdg=!1;
    },function(e){ toast("Error fetching feed."); isLdg=!1; });
}

function loadMorePosts(){ fetchPosts(!0); }

// Optimized DOM Injection
function updateUI(p,posts,pag){
    document.getElementById('profileCard').className='card';
    document.getElementById('pfp').src=p.avatar||'';
    document.getElementById('displayName').innerHTML=p.displayName||curHandle;
    document.getElementById('handle').innerHTML='@'+p.handle;
    document.getElementById('bio').innerHTML=p.description||"No bio.";
    document.getElementById('followers').innerHTML=fmtNum(p.followersCount);
    document.getElementById('following').innerHTML=fmtNum(p.followsCount);
    document.getElementById('postsCount').innerHTML=fmtNum(p.postsCount);

    var htmlString = '';
    for(var i=0; i<posts.length; i++){
        var it=posts[i], u=it.post.uri, c=it.post.cid,
            ru=(it.post.record.reply&&it.post.record.reply.root)?it.post.record.reply.root.uri:u,
            rc=(it.post.record.reply&&it.post.record.reply.root)?it.post.record.reply.root.cid:c,
            rb=sess?'<button onclick="toggleReply(\''+c+'\')">Reply</button> ':'',
            lk=it.post.likeCount||0, rp=it.post.repostCount||0, rpl=it.post.replyCount||0,
            txt=it.post.record.text||"[No text]", rd=it.post.record.createdAt||it.post.indexedAt,
            dt=rd?new Date(rd):null, fd=dt?(dt.getFullYear()+"-"+(dt.getMonth()+1)+"-"+dt.getDate()):"Unknown date", eh='';

        if(it.post.embed && (it.post.embed.$type==='app.bsky.embed.images#view'||it.post.embed.images)){
            var im=it.post.embed.images||[];
            for(var j=0;j<im.length;j++){
                eh+='<img src="'+im[j].thumb+'" class="post-img" onclick="openLightbox(\''+(im[j].fullsize||im[j].thumb)+'\')" alt="img">';
            }
        }

        var ld=sess?'<button onclick="likePost(\''+u+'\', \''+c+'\')">Like</button> ':'';
        var vc='<button onclick="toggleComments(\''+u+'\', \''+c+'\')">Comments</button>';
        
        htmlString += '<div class="post"><div class="post-date">🕒 '+fd+'</div><p>'+txt+'</p><div>'+eh+'</div>'+
            '<div class="post-stats"><span class="stat-item">💬 <b>'+rpl+'</b></span>'+
            '<span class="stat-item">🔁 <b>'+rp+'</b></span><span class="stat-item">❤️ <b>'+lk+'</b></span>'+
            rb+ld+vc+'</div>'+
            '<div id="reply-box-'+c+'" class="reply-area hidden">'+
            '<textarea id="reply-input-'+c+'" placeholder="Write reply..."></textarea><br>'+
            '<button onclick="submitReply(\''+u+'\',\''+c+'\',\''+ru+'\',\''+rc+'\')">Send</button></div>'+
            '<div id="comments-'+c+'" class="comments-area hidden"></div></div>';
    }
    
    var f=document.getElementById('feed');
    if(pag) f.innerHTML += htmlString; else f.innerHTML = htmlString;
}

function submitPost(){
    if(!sess) return toast("Login required.");
    var el=document.getElementById('new-post-input'), t=el.value;
    if(!t) return toast("Post is empty!");
    ajax('POST',A_API+'/com.atproto.repo.createRecord',{'Authorization':'Bearer '+sess.accessJwt},{
        repo:sess.did, collection:"app.bsky.feed.post", record:{$type:"app.bsky.feed.post",text:t,createdAt:new Date().toISOString()}
    },function(r){
        toast("Posted!"); el.value=""; 
        if(curHandle.toLowerCase()===sess.handle.toLowerCase()) fetchUserData();
    },function(e){ toast("Error: "+e.message); });
}

function likePost(u,c){
    if(!sess) return;
    ajax('POST',A_API+'/com.atproto.repo.createRecord',{'Authorization':'Bearer '+sess.accessJwt},{
        repo:sess.did, collection:"app.bsky.feed.like", record:{$type:"app.bsky.feed.like",subject:{uri:u,cid:c},createdAt:new Date().toISOString()}
    },function(r){ toast("Liked!"); },function(e){ toast("Error."); });
}

window.openLightbox=function(u){
    var l=document.getElementById('lightbox'), i=document.getElementById('lightboxImg');
    if(l&&i){ i.src=u; l.className=''; }
};

window.closeLightbox=function(){
    var l=document.getElementById('lightbox'); if(l) l.className='hidden';
};

window.toggleReply=function(c){
    var b=document.getElementById('reply-box-'+c);
    b.className=b.className.indexOf('hidden')!==-1?'reply-area':'reply-area hidden';
};

window.submitReply=function(pu,pc,ru,rc){
    if(!sess) return;
    var i=document.getElementById('reply-input-'+pc), t=i.value;
    if(!t) return;
    ajax('POST',A_API+'/com.atproto.repo.createRecord',{'Authorization':'Bearer '+sess.accessJwt},{
        repo:sess.did, collection:"app.bsky.feed.post", record:{
            $type:"app.bsky.feed.post", text:t, createdAt:new Date().toISOString(), reply:{root:{uri:ru,cid:rc},parent:{uri:pu,cid:pc}}
        }
    },function(r){ toast("Reply posted!"); i.value=""; window.toggleReply(pc); },function(e){ toast("Error."); });
};

window.toggleComments = function(uri, cid) {
    var container = document.getElementById('comments-' + cid);
    if (container.className.indexOf('hidden') === -1) { container.className = 'comments-area hidden'; return; }
    container.className = 'comments-area';
    if (container.innerHTML !== '') return; 
    
    container.innerHTML = '<p style="color:#b5bac1">Loading...</p>';
    var url = (sess ? A_API : P_API) + '/app.bsky.feed.getPostThread?uri=' + encodeURIComponent(uri);
    
    ajax('GET', url, sess ? {'Authorization':'Bearer '+sess.accessJwt} : null, null, function(res) {
        var reps = res.thread.replies;
        if (!reps || reps.length === 0) { container.innerHTML = '<p style="color:#b5bac1">No comments.</p>'; return; }
        
        var html = '';
        for (var i = 0; i < reps.length; i++) {
            if (reps[i].post && reps[i].post.record) {
                html += '<div class="comment"><b style="color:#0085ff">@' + reps[i].post.author.handle + '</b><br>' + (reps[i].post.record.text || '') + '</div>';
            }
        }
        container.innerHTML = html;
    }, function(err) { container.innerHTML = '<p style="color:#ff5959">Error.</p>'; });
};