(() => {
  'use strict';

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

  const renderPosts = (posts) => {
    posts.forEach((url) => {
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
        newPosts = Array.isArray(data.posts) ? data.posts.map((post) => post.url) : [];
      }
    } catch {
      // El Blog sigue mostrando sus publicaciones históricas si el servicio no está disponible.
    }
    renderPosts([...newPosts, ...historicalPosts.filter((url) => !newPosts.includes(url))]);

    const script = document.createElement('script');
    script.async = true;
    script.src = 'https://www.instagram.com/embed.js';
    document.body.appendChild(script);
  };

  loadPosts();
})();
