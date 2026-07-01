package model;

import java.math.BigInteger;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;

public class User {
	
	private String salt, password, email, name;
	private boolean newPassword;

	public User(String email, String name, String password) {
		super();
		this.email = email;
		this.name = name;
		setPassword(password);
	}
	
	
	public User(String email, String name,String password, String salt) {
		super();
		this.salt = salt;
		this.password = password;
		this.email = email;
		this.name = name;
		newPassword = false;
	}


	public void setPassword(String password){
		 SecureRandom random = new SecureRandom();
		 salt = new BigInteger(64, random).toString(16);
		 
		 this.password = hash(password+salt);
		 for (int i = 0; i < 512; i++) {
			this.password = hash(this.password + salt);
		}
		newPassword = true;

		 
	}
	
	private String hash(String toHash){
		 try {
			MessageDigest md = MessageDigest.getInstance("SHA-256");
			    md.update(toHash.getBytes());
 
			    byte byteData[] = md.digest();
 
			    //convert the byte to hex format method 1
			    StringBuffer sb = new StringBuffer();
			    for (int i = 0; i < byteData.length; i++) {
			     sb.append(Integer.toString((byteData[i] & 0xff) + 0x100, 16).substring(1));
			    }
			    return sb.toString();
		} catch (NoSuchAlgorithmException e) {
			// TODO Auto-generated catch block
			e.printStackTrace();
		}
		 return null;
	}

	public String getEmail() {
		return email;
	}

	public void setEmail(String email) {
		this.email = email;
	}

	public String getName() {
		return name;
	}

	public void setName(String name) {
		this.name = name;
	}

	public String getSalt() {
		return salt;
	}

	public String getPassword() {
		return password;
	}
	
	


	public String getNewPassword() {
		return newPassword ? "X" : "";
	}

	public String toString(){
		return getName() + "(" + getEmail() + ")";
	}

}
