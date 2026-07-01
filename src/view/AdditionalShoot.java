package view;


import java.io.IOException;

import javafx.fxml.FXML;
import javafx.fxml.FXMLLoader;
import javafx.scene.control.ChoiceBox;
import javafx.scene.control.TextField;
import javafx.scene.layout.GridPane;

public class AdditionalShoot extends GridPane{

	@FXML
	public TextField firstname, lastname, start, end, score;
	
	@FXML
	private ChoiceBox<String> ageclass;
	
	public AdditionalShoot(String firstname, String lastname, String ageclass, int start, int end, double score){
		try {
			FXMLLoader fxmlLoader = new FXMLLoader(
					CreateSeason.class.getResource("AdditionalShoot.fxml"));
			fxmlLoader.setRoot(this);
			fxmlLoader.setController(this);
			fxmlLoader.load();
		} catch (IOException e) {
			// TODO Auto-generated catch block
			e.printStackTrace();
		}
		this.firstname.setText(firstname);
		this.lastname.setText(lastname);
		this.ageclass.setValue(ageclass);
		this.start.setText(start >= 0 ? String.valueOf(start) : "");
		this.end.setText(end >= 0 ? String.valueOf(end) : "");
		this.score.setText(String.valueOf(score).replace(".", ","));
	}

	public String getFirstname() {
		return firstname.getText();
	}

	public String getLastname() {
		return lastname.getText();
	}

	public String getAgeclass() {
		return ageclass.getValue();
	}

	public String getStart() {
		return start.getText();
	}

	public String getEnd() {
		return end.getText();
	}

	public String getScore() {
		return score.getText();
	}
	
	
	
}
