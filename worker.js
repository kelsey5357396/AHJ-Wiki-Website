// AHJ.wiki Worker - Email capture for early access waitlist

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST, GET',
          'Access-Control-Allow-Headers': 'Content-Type',
        },
      });
    }

    // Handle email subscription
    if (request.method === 'POST' && url.pathname === '/api/subscribe') {
      try {
        const formData = await request.formData();
        const email = formData.get('email_address');

        if (!email || !email.includes('@')) {
          return new Response(JSON.stringify({ error: 'Invalid email' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' },
          });
        }

        // Save to D1 database
        await env.DB.prepare(
          'INSERT OR IGNORE INTO subscribers (email, subscribed_at) VALUES (?, ?)'
        )
          .bind(email, new Date().toISOString())
          .run();

        return new Response(
          JSON.stringify({
            success: true,
            message: "You're on the list!",
          }),
          {
            status: 200,
            headers: {
              'Content-Type': 'application/json',
              'Access-Control-Allow-Origin': '*',
            },
          }
        );
      } catch (error) {
        console.error('Error saving email:', error);
        return new Response(JSON.stringify({ error: 'Error saving email' }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        });
      }
    }

    // Subscriber export endpoint (protect with auth in production)
    if (request.method === 'GET' && url.pathname === '/api/subscribers') {
      // Basic auth check
      const authHeader = request.headers.get('Authorization');
      if (!authHeader) {
        return new Response('Authentication required', {
          status: 401,
          headers: {
            'WWW-Authenticate': 'Basic realm="AHJ Admin", charset="UTF-8"',
          },
        });
      }

      const base64Credentials = authHeader.split(' ')[1];
      const credentials = atob(base64Credentials);
      const [username, password] = credentials.split(':');

      if (username !== env.ADMIN_USERNAME || password !== env.ADMIN_PASSWORD) {
        return new Response('Invalid credentials', {
          status: 401,
          headers: {
            'WWW-Authenticate': 'Basic realm="AHJ Admin", charset="UTF-8"',
          },
        });
      }

      try {
        const { results } = await env.DB.prepare(
          'SELECT email, subscribed_at FROM subscribers ORDER BY subscribed_at DESC'
        ).all();

        return new Response(JSON.stringify(results, null, 2), {
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
        });
      } catch (error) {
        return new Response(JSON.stringify({ error: 'Error fetching subscribers' }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        });
      }
    }

    // Let all other requests pass through to static assets
    return env.ASSETS.fetch(request);
  },
};
