(() => {
  'use strict';

  const MAX_POST_AGE = 14 * 24 * 60 * 60 * 1000;

  // Estas publicaciones se conservan como archivo histórico del Blog.
  const historicalPosts = [
    'https://www.instagram.com/p/DdPYv1UHdBc/',
    'https://www.instagram.com/p/Da4-sbsFZmh/',
    'https://www.instagram.com/p/DaqHSPslZks/',
    'https://www.instagram.com/p/DalXprWnRCx/',
    'https://www.instagram.com/p/DagQAdJHXHG/',
    'https://www.instagram.com/p/DaVsH3_lNBr/',
    'https://www.instagram.com/p/DaS8UQplTC0/',
    'https://www.instagram.com/p/DaL0GE8Hd0M/',
    'https://www.instagram.com/p/DaI065IlO5h/',
    'https://www.instagram.com/p/DaAdd2AlWD9/',
    'https://www.instagram.com/p/DZ-BJXJFXGW/',
    'https://www.instagram.com/p/DZ54KPonYja/'
  ];

  const feed = document.getElementById('instagram-feed');
  if (!feed) return;

  const isRecent = (post) => {
    const date = Date.parse(post.publishedAt);
    return Number.isFinite(date) && Date.now() - date <= MAX_POST_AGE;
  };

  const renderPosts = (posts) => {
    posts.forEach((postData) => {
      const url = postData.url;
      const post = document.createElement('blockquote');
      post.className = 'instagram-media';
      post.dataset.instgrmCaptioned = '';
      post.dataset.instgrmPermalink = url;
      post.dataset.instgrmVersion = '14';

      const link = document.createElement('a');
      link.href = url;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      link.textContent = 'Ver publicación de Radio Conexión en Instagram';
      post.appendChild(link);
      feed.appendChild(post);
    });
  };

  const loadPosts = async () => {
    let newPosts = [];
    try {
      const response = await fetch('/api/blog-posts');
      if (response.ok) {
        const data = await response.json();
        newPosts = Array.isArray(data.posts) ? data.posts : [];
      }
    } catch {
      // El Blog sigue mostrando sus publicaciones históricas si el servicio no está disponible.
    }
    const historicalWithDates = historicalPosts.map((url) => ({ url, publishedAt: '2026-09-13T00:00:00-03:00' }));
    const posts = [...newPosts, ...historicalWithDates.filter((post) => !newPosts.some((newPost) => newPost.url === post.url))]
      .filter(isRecent)
      .sort((first, second) => Date.parse(second.publishedAt) - Date.parse(first.publishedAt));
    renderPosts(posts);

    const script = document.createElement('script');
    script.async = true;
    script.src = 'https://www.instagram.com/embed.js';
    document.body.appendChild(script);
  };

  loadPosts();
})();
