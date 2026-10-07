package GraphServer;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.SocketTimeoutException;

/**
 * Transporte WebSocket para la version web (CheerpJ).
 *
 * Los metodos "native" los implementa JavaScript (ver index.html, opcion "natives"
 * de cheerpjInit). Cada mensaje WebSocket es UNA linea del protocolo de Graphwar
 * (sin el salto de linea final); el proxy se encarga de convertir de/hacia TCP.
 *
 * Se activa solo si existe la propiedad de sistema "graphwar.ws"
 * (se define en cheerpjInit con javaProperties).
 */
public class WebTransport
{
	public static String baseUrl()
	{
		return System.getProperty("graphwar.ws");
	}

	public static boolean enabled()
	{
		String url = baseUrl();
		return url != null && url.length() > 0;
	}

	// Partidas locales (localhost) no pasan por el proxy
	public static boolean isLocal(String ip)
	{
		return ip == null || ip.equalsIgnoreCase("localhost") || ip.startsWith("127.");
	}

	// Implementados en JavaScript
	static native int open(String url);                 // id >= 0, o -1 si falla
	static native String recv(int id, int timeoutMs);   // "L<linea>", "T" (timeout) o "C" (cerrado)
	static native int send(int id, String line);        // 1 ok, 0 error
	static native void close(int id);

	public static class In extends InputStream
	{
		private final int id;
		private final int timeoutMs;
		private byte[] cur = new byte[0];
		private int pos = 0;
		private boolean eof = false;

		public In(int id, int timeoutMs)
		{
			this.id = id;
			this.timeoutMs = timeoutMs;
		}

		// Devuelve false si se llego al final de la conexion
		private boolean fill() throws IOException
		{
			if(eof)
			{
				return false;
			}

			String r = recv(id, timeoutMs);

			if(r == null || r.length() == 0 || r.charAt(0) == 'C')
			{
				eof = true;
				return false;
			}

			if(r.charAt(0) == 'T')
			{
				throw new SocketTimeoutException("Read timed out");
			}

			cur = (r.substring(1) + "\n").getBytes("UTF-8");
			pos = 0;
			return true;
		}

		public int read() throws IOException
		{
			if(pos >= cur.length && !fill())
			{
				return -1;
			}

			return cur[pos++] & 0xFF;
		}

		public int read(byte[] b, int off, int len) throws IOException
		{
			if(len == 0)
			{
				return 0;
			}

			if(pos >= cur.length && !fill())
			{
				return -1;
			}

			int n = Math.min(len, cur.length - pos);
			System.arraycopy(cur, pos, b, off, n);
			pos += n;
			return n;
		}

		public int available()
		{
			return cur.length - pos;
		}

		public void close()
		{
			// el cierre real lo hace Connection.close()
		}
	}

	public static class Out extends OutputStream
	{
		private final int id;
		private final ByteArrayOutputStream buf = new ByteArrayOutputStream();

		public Out(int id)
		{
			this.id = id;
		}

		public void write(int b)
		{
			buf.write(b);
		}

		public void write(byte[] b, int off, int len)
		{
			buf.write(b, off, len);
		}

		// Envia cada linea completa acumulada como un mensaje WebSocket
		public void flush() throws IOException
		{
			String all = buf.toString("UTF-8");
			int start = 0;
			int nl;

			while((nl = all.indexOf('\n', start)) >= 0)
			{
				String line = all.substring(start, nl);

				if(line.endsWith("\r"))
				{
					line = line.substring(0, line.length() - 1);
				}

				if(send(id, line) == 0)
				{
					throw new IOException("WebSocket closed");
				}

				start = nl + 1;
			}

			buf.reset();

			if(start < all.length())
			{
				buf.write(all.substring(start).getBytes("UTF-8"));
			}
		}

		public void close() throws IOException
		{
			// el cierre real lo hace Connection.close()
		}
	}
}
