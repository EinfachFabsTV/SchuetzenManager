package tools;


import java.util.Properties;

import javax.mail.Message;
import javax.mail.PasswordAuthentication;
import javax.mail.Session;
import javax.mail.Transport;
import javax.mail.internet.InternetAddress;
import javax.mail.internet.MimeMessage;

import property.PropertiyFactory;

public class SendMail {
	   
	private static final String username = PropertiyFactory.get("mail.username");
	private static final String password = PropertiyFactory.get("mail.password");
	private static final String senderAddress = PropertiyFactory.get("mail.senderAdress");
	


    
    public static void sendMail(String recipientsAddress,String subject,String text){
 
    	System.out.println(username);
    	System.out.println(password);
        Properties props = new Properties();
		props.put("mail.smtp.auth", PropertiyFactory.get("mail.smtp.auth"));
		props.put("mail.smtp.starttls.enable", PropertiyFactory.get("mail.smtp.starttls.enable"));
		props.put("mail.smtp.host", PropertiyFactory.get("mail.smtp.host"));
		props.put("mail.smtp.port", PropertiyFactory.get("mail.smtp.port"));
		Session session = Session.getInstance(props,
				  new javax.mail.Authenticator() {
					protected PasswordAuthentication getPasswordAuthentication() {
						return new PasswordAuthentication(username, password);
					}
				  });
 
        try {
            Message msg = new MimeMessage(session);
 
            msg.setFrom(new InternetAddress(senderAddress));
            msg.setRecipients(Message.RecipientType.TO, InternetAddress.parse(
                    recipientsAddress, false));
 
            msg.setSubject(subject);
            msg.setText(text);
 
            Transport.send(msg);
 
        }
        catch (Exception e) {
            e.printStackTrace( );
        }
    }
   
  
    public static void main(String[] args) {
    	SendMail.sendMail("ch.kater@gmail.com", "Test", "Dies ist eine Mail von Java.");
    }
}