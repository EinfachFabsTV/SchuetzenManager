package view;

import java.io.IOException;
import java.util.GregorianCalendar;

import javafx.beans.binding.Bindings;
import javafx.beans.value.ChangeListener;
import javafx.beans.value.ObservableValue;
import javafx.collections.FXCollections;
import javafx.collections.ObservableList;
import javafx.event.ActionEvent;
import javafx.event.EventHandler;
import javafx.fxml.FXML;
import javafx.fxml.FXMLLoader;
import javafx.scene.control.Button;
import javafx.scene.control.ChoiceBox;
import javafx.scene.control.ContextMenu;
import javafx.scene.control.Control;
import javafx.scene.control.Label;
import javafx.scene.control.MenuItem;
import javafx.scene.control.TableRow;
import javafx.scene.control.TableView;
import javafx.scene.control.TextField;
import javafx.scene.layout.GridPane;
import javafx.stage.Stage;
import model.Season;
import model.Team;

import org.controlsfx.validation.ValidationResult;
import org.controlsfx.validation.ValidationSupport;
import org.controlsfx.validation.Validator;

import com.ibm.icu.util.Calendar;

import database.Database;

public class CreateSeason extends GridPane {

	@FXML
	private Label info;

	@FXML
	private TextField year, label, name, contact, phone, loc;

	@FXML
	private ChoiceBox<String> h, m, trainingday;

	@FXML
	private TableView<Team> teams;
	
	@FXML 
	private Button create, addTeam;

	private ObservableList<Team> teamList;

	private Stage stage;
	private ValidationSupport createValidation = new ValidationSupport();
	private ValidationSupport addTeamValidation = new ValidationSupport();
	
	private Validator teamsValidator = (c, newValue) -> {
		if (teamList.size() < 2) {
			return ValidationResult
					.fromErrorIf(
							(Control) c,
							"Es müssen mindestens 2 Mannschaften der Saison hinzugefügt werden.",
							true);

		} else {
			return ValidationResult.fromErrorIf((Control) c, "",
					false);
		}
	};
	
	private Validator nameFocusValidator = (c, newValue) -> {
		if(name.getText().trim().length() == 0){
			return ValidationResult.fromError((Control) c, "Wenn Sie eine Mannschaft hinzufügen möchten, müssen Sie einen Teamnamen angeben.");
		} else if(teamExists()){
			return ValidationResult.fromError((Control) c, "Der Mannschftsname ist bereits vorhanden. Geben Sie einen anderen ein.");
		} else{
			return ValidationResult.fromErrorIf((Control) c, "",
					false);
		}
	};
	
	private Validator nameValidator = (c, newValue) -> {
		if(teamExists()){
			return ValidationResult.fromError((Control) c, "Der Mannschftsname ist bereits vorhanden. Geben Sie einen anderen ein.");
		} else{
			return ValidationResult.fromErrorIf((Control) c, "",
					false);
		}
	};

	public CreateSeason(Stage stage) {
		teamList = FXCollections.observableArrayList();
		this.stage = stage;
		try {
			FXMLLoader fxmlLoader = new FXMLLoader(getClass().getResource(
					"CreateSeason.fxml"));
			fxmlLoader.setRoot(this);
			fxmlLoader.setController(this);
			fxmlLoader.load();
		} catch (IOException e) {
			// TODO Auto-generated catch block
			e.printStackTrace();
		}
		GregorianCalendar cal = new GregorianCalendar();
		year.setText(String.valueOf(cal.get(Calendar.YEAR)));
		ContextMenu cm = new ContextMenu();
		MenuItem mi1 = new MenuItem("Löschen");
		cm.getItems().add(mi1);
		teams.setItems(teamList);
		teams.setRowFactory(tableview -> {
			final TableRow<Team> row = new TableRow<>();
			final ContextMenu contextMenu = new ContextMenu();
			final MenuItem removeMenuItem = new MenuItem("Löschen");
			removeMenuItem.setOnAction(new EventHandler<ActionEvent>() {
				@Override
				public void handle(ActionEvent event) {
					teams.getItems().remove(row.getItem());
					createValidation.registerValidator(teams, false, teamsValidator);
				}
			});
			contextMenu.getItems().add(removeMenuItem);
			// Set context menu on row, but use a binding to make it only show
			// for non-empty rows:
			row.contextMenuProperty().bind(
					Bindings.when(row.emptyProperty()).then((ContextMenu) null)
							.otherwise(contextMenu));
			return row;
		});
		year.lengthProperty().addListener(new ChangeListener<Number>() {

			@Override
			public void changed(ObservableValue<? extends Number> observable,
					Number oldValue, Number newValue) {

				String text = year.getText();

				if (text.length() > 0) {
					char ch = text.charAt(text.length() - 1);
					// Check if the new character is the number or other's
					if (!(ch >= '0' && ch <= '9') || text.length() > 4) {

						// if it's not number then just setText to previous one
						year.setText(year.getText().substring(0,
								year.getText().length() - 1));
					}
				}
			}

		});
		createValidation
				.registerValidator(
						label,
						false,
						Validator
								.createEmptyValidator("Es muss eine Sportklasse angegeben werden"));
		
		createValidation.registerValidator(teams, false, teamsValidator);
		
		createValidation.invalidProperty().addListener((observable, oldValue, newValue) -> {
			create.setDisable(newValue);
		});
		
		createValidation.registerValidator(year, false, Validator.createEmptyValidator("Es muss das Jahr angegeben werden."));
		
		name.focusedProperty().addListener((observable, oldValue, newValue) -> {
			if(newValue){
				addTeamValidation.registerValidator(name, false, nameFocusValidator);
			}else{
				addTeamValidation.registerValidator(name, false, nameValidator);
				addTeam.setDisable(addTeam.isDisable() || name.getText().trim().length() == 0);
			}
		});
		addTeamValidation.invalidProperty().addListener((observable, oldValue, newValue) -> {
			addTeam.setDisable(newValue || name.getText().trim().length() == 0);
		});
	}

	@FXML
	protected void addTeam() {
		Team newTeam = new Team(name.getText(), trainingday.getValue(),
				h.getValue() + ":" + m.getValue(), loc.getText(),
				contact.getText(), phone.getText());
		teamList.add(newTeam);
		TextField[] resetFields = new TextField[] { name, loc, contact, phone };
		for (int i = 0; i < resetFields.length; i++) {
			resetFields[i].setText("");
		}
		trainingday.setValue("Montag");
		h.setValue("20");
		m.setValue("00");
		name.requestFocus();
		createValidation.registerValidator(teams, false, teamsValidator);
	}


	@FXML
	protected void create() {
		stage.close();
		Database.getInstance().createSeason(
				new Season(Integer.parseInt(year.getText()), label.getText(),
						teamList));
	}

	@FXML
	protected void close() {
		stage.close();

	}

	private boolean teamExists() {
		for (Team team : teamList) {
			if (team.getName().equals(name.getText())) {
				return true;
			}
		}
		return false;
	}

}
