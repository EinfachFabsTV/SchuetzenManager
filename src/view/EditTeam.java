package view;

import java.io.IOException;

import javafx.fxml.FXML;
import javafx.fxml.FXMLLoader;
import javafx.scene.control.Button;
import javafx.scene.control.ChoiceBox;
import javafx.scene.control.TextField;
import javafx.scene.layout.GridPane;
import javafx.stage.Stage;
import model.Season;
import model.Team;

import org.controlsfx.validation.ValidationResult;
import org.controlsfx.validation.ValidationSupport;

import database.Database;

public class EditTeam extends GridPane {

	private Team team;
	private Stage stage;

	@FXML
	private TextField name, loc, contact, phone;

	@FXML
	private ChoiceBox<String> h, m, trainingday;
	
	@FXML
	private Button save;
	
	private Season season;

	private String oldName;
	private ValidationSupport validationSupport = new ValidationSupport();

	public EditTeam(Team team, Stage stage, Season season) {
		oldName = team.getName();
		this.season = season;
		this.team = team;
		this.stage = stage;
		try {
			FXMLLoader fxmlLoader = new FXMLLoader(
					CreateSeason.class.getResource("EditTeam.fxml"));
			fxmlLoader.setRoot(this);
			fxmlLoader.setController(this);
			fxmlLoader.load();
		} catch (IOException e) {
			// TODO Auto-generated catch block
			e.printStackTrace();
		}
		name.setText(team.getName());
		trainingday.setValue(team.getTrainingday());
		h.setValue(team.getTrainingtime().split(":")[0]);
		m.setValue(team.getTrainingtime().split(":")[1]);
		loc.setText(team.getLocation());
		contact.setText(team.getContact());
		phone.setText(team.getPhone());
		validationSupport.registerValidator(name, false, (c, newValue) -> {
			if (checkTeamName((String) newValue)) {
				save.setDisable(true);
				return ValidationResult.fromErrorIf(c,
						"Der Mannschaftsname ist bereits belegt", true);
				
			} else if(name.getText().trim().length() == 0){
				save.setDisable(true);
				return ValidationResult.fromErrorIf(c,
						"Es muss ein Mannschaftsname gewählt werden", true);
			}else {
				save.setDisable(false);
				return ValidationResult.fromErrorIf(c,
						"", false);
			}
		});
		
	}

	@FXML
	protected void save() {
		if (validationSupport.isInvalid()) {
			return;
		}
		team.setName(name.getText());
		team.setTrainingday(trainingday.getValue());
		team.setTrainingtime(String.format("%02d:%02d",
				Integer.parseInt(h.getValue()), Integer.parseInt(m.getValue())));
		team.setLocation(loc.getText());
		team.setContact(contact.getText());
		team.setPhone(phone.getText());
		stage.close();
		System.out.println(oldName);
		Database.getInstance().updateTeam(team, oldName);
	}

	@FXML
	protected void cancel() {
		stage.close();
	}

	private boolean checkTeamName(String teamname) {
		System.out.println(teamname);
		boolean result = false;
		for (Team team : season.getTeams()) {
			if (team.getName().equals(teamname) && !oldName.equals(teamname)) {
				result = true;
			}
		}
		System.out.println(result);
		return result;
	}
}
