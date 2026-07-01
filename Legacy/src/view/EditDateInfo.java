package view;

import java.io.IOException;

import javafx.fxml.FXML;
import javafx.fxml.FXMLLoader;
import javafx.scene.control.TextArea;
import javafx.scene.control.TextField;
import javafx.scene.layout.GridPane;
import javafx.stage.Stage;
import database.Database;

public class EditDateInfo extends GridPane{

	@FXML
	private TextField contact, mail;

	@FXML
	private TextArea infobox;
	
	private Stage stage;
	
	public EditDateInfo(Stage stage, String person, String mail, String infobox) {
		this.stage = stage;
		try {
			FXMLLoader fxmlLoader = new FXMLLoader(
					CreateSeason.class.getResource("EditDateInfo.fxml"));
			fxmlLoader.setRoot(this);
			fxmlLoader.setController(this);
			fxmlLoader.load();
		} catch (IOException e) {
			// TODO Auto-generated catch block
			e.printStackTrace();
		}
		contact.setText(person);
		this.mail.setText(mail);
		this.infobox.setText(infobox);
	}
	
	@FXML
	protected void save(){
		Database.getInstance().updateInfo(contact.getText(), mail.getText(), infobox.getText());
		stage.close();

	}
	
	@FXML
	protected void cancel(){
		stage.close();
	}
}
