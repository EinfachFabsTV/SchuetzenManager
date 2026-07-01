package property;

import java.io.FileInputStream;
import java.io.FileNotFoundException;
import java.io.IOException;
import java.util.Properties;

public class PropertiyFactory {
	private static Properties properties;
	
	public static String get(String key){
		initialize();
		return properties.getProperty(key);
	}
	
	private static void initialize() {
		if(properties == null){
			try {
				properties = new Properties();
				FileInputStream in = new FileInputStream("config.properties");
				properties.load(in);
				in.close();
			} catch (FileNotFoundException e) {
				// TODO Auto-generated catch block
				e.printStackTrace();
			} catch (IOException e) {
				// TODO Auto-generated catch block
				e.printStackTrace();
			}
		}
		
	}

}
