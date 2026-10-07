//  Copyright (C) 2011 Lucas Catabriga Rocha <catabriga90@gmail.com>
//    
//  This file is part of Graphwar.
//
//  Graphwar is free software: you can redistribute it and/or modify
//  it under the terms of the GNU General Public License as published by
//  the Free Software Foundation, either version 3 of the License, or
//  (at your option) any later version.
//
//  Graphwar is distributed in the hope that it will be useful,
//  but WITHOUT ANY WARRANTY; without even the implied warranty of
//  MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
//  GNU General Public License for more details.

//  You should have received a copy of the GNU General Public License
//  along with Graphwar.  If not, see <http://www.gnu.org/licenses/>.

package GraphServer;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStreamReader;
import java.io.PrintWriter;
import java.net.InetSocketAddress;
import java.net.Socket;
import java.net.SocketAddress;
import java.net.SocketTimeoutException;
import java.util.concurrent.LinkedBlockingQueue;
import java.util.concurrent.TimeUnit;

public class Connection
{
	private static final String LOCAL_CLOSE = "\u0000GRAPHWAR_LOCAL_CLOSE";
	private Socket socket;          // null cuando se usa el transporte WebSocket
	private int wsId = -1;
	private String wsHost = null;
	private PrintWriter out;
	private BufferedReader in;
	private LinkedBlockingQueue<String> localIncoming;
	private LinkedBlockingQueue<String> localOutgoing;
	private boolean local;
	
	private long lastReceivedTime;
	private long lastSentTime;
	
	public Connection(String ip, int port) throws IOException
	{
		if(WebTransport.enabled() && !WebTransport.isLocal(ip))
		{
    		// Version web: TCP no existe en el navegador, se pasa por el proxy WebSocket
   	 		String url = WebTransport.baseUrl() + "/?host=" + java.net.URLEncoder.encode(ip, "UTF-8") + "&port=" + port;

    		wsId = WebTransport.open(url);
			
    		if(wsId < 0)
    		{
        		throw new IOException("Could not connect to " + ip + ":" + port + " through the WebSocket proxy");
    		}

    		wsHost = ip;
    		out = new PrintWriter(new WebTransport.Out(wsId), true);
    		in = new BufferedReader(new InputStreamReader(new WebTransport.In(wsId, Constants.TIMEOUT_KEEPALIVE)));

    		lastReceivedTime = System.currentTimeMillis();
    		lastSentTime = System.currentTimeMillis();

    		return;
		}
		local = false;		
		SocketAddress sockaddr = new InetSocketAddress(ip, port);
		socket = new Socket();
		
		socket.connect(sockaddr, Constants.TIMEOUT_CONNECTING);
		
		socket.setSoTimeout(Constants.TIMEOUT_KEEPALIVE);
		out = new PrintWriter(socket.getOutputStream(), true);
		in = new BufferedReader(new InputStreamReader(socket.getInputStream()));		
		
		lastReceivedTime = System.currentTimeMillis();
		lastSentTime = System.currentTimeMillis();
				
	}
		
	public Connection(Socket socket) throws IOException
	{
		local = false;
		this.socket = socket;
		
		socket.setSoTimeout(Constants.TIMEOUT_KEEPALIVE);
		
		out = new PrintWriter(socket.getOutputStream(), true);
		in = new BufferedReader(new InputStreamReader(socket.getInputStream()));	
	}
	
	private Connection() { local = true; }

	public static Connection[] createLocalPair()
	{
		Connection a = new Connection();
		Connection b = new Connection();
		LinkedBlockingQueue<String> q1 = new LinkedBlockingQueue<String>();
		LinkedBlockingQueue<String> q2 = new LinkedBlockingQueue<String>();
		a.localIncoming = q1; a.localOutgoing = q2;
		b.localIncoming = q2; b.localOutgoing = q1;
		long now = System.currentTimeMillis();
		a.lastReceivedTime = now; a.lastSentTime = now;
		b.lastReceivedTime = now; b.lastSentTime = now;
		return new Connection[] {a,b};
	}

	public void close() throws IOException
	{
		out.close();
		in.close();
		
		if(socket != null)
		{
    		socket.close();
		}
		else if(wsId >= 0)
		{
    		WebTransport.close(wsId);
		}
	}
	
	public String getIpAddress()
	{
    	if(local) return "127.0.0.1";
    	if(socket == null)
    	{
        	return wsHost;
    	}
    	return socket.getInetAddress().getHostAddress();
	}
	
	public long getLastSentTime()
	{
		return this.lastSentTime;
	}
	
	public long getLastReceivedTime()
	{
		return this.lastReceivedTime;
	}
	
	public synchronized void sendMessage(String message)
	{
		if(local) { localOutgoing.offer(message); lastSentTime = System.currentTimeMillis(); return; }
		out.println(message);
		lastSentTime = System.currentTimeMillis();
		//System.out.println("Message sent: "+message);
	}
	
	public String readMessage() throws IOException
	{
		if(local) {
			try {
				String line = localIncoming.poll(Constants.TIMEOUT_KEEPALIVE, TimeUnit.MILLISECONDS);
				if(line == null) throw new SocketTimeoutException();
				if(LOCAL_CLOSE.equals(line)) return null;
				lastReceivedTime = System.currentTimeMillis();
				return line;
			} catch(InterruptedException e) { Thread.currentThread().interrupt(); throw new IOException(e); }
		}
		String line = in.readLine();
		lastReceivedTime = System.currentTimeMillis();
		return line;
	}
}
