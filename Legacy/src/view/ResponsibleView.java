package view;

import java.io.IOException;
import java.sql.SQLException;

import javafx.application.Platform;
import javafx.beans.binding.Bindings;
import javafx.collections.ObservableList;
import javafx.event.ActionEvent;
import javafx.event.EventHandler;
import javafx.fxml.FXML;
import javafx.fxml.FXMLLoader;
import javafx.scene.control.Button;
import javafx.scene.control.ChoiceBox;
import javafx.scene.control.ContextMenu;
import javafx.scene.control.Label;
import javafx.scene.control.MenuItem;
import javafx.scene.control.TableRow;
import javafx.scene.control.TableView;
import javafx.scene.layout.GridPane;
import javafx.stage.Stage;
import model.Responsible;
import model.Team;
import model.User;

import org.controlsfx.control.action.Action;
import org.controlsfx.dialog.Dialog;
import org.controlsfx.dialog.Dialogs;
import org.controlsfx.validation.ValidationResult;
import org.controlsfx.validation.ValidationSupport;

import database.Database;

public class ResponsibleView extends GridPane {
	@FXML
	private TableView<Responsible> responsible;

	@FXML
	private ChoiceBox<User> users;

	@FXML
	private ChoiceBox<Team> teams;

	@FXML
	private Label info;
	
	@FXML
	private Button add;

	private Stage dialog;

	private ObservableList<Responsible> userTeamMatches;
	private ValidationSupport validationSupport = new ValidationSupport();

	public ResponsibleView(ObservableList<Team> teams, Stage dialog) {
		try {
			FXMLLoader fxmlLoader = new FXMLLoader(
					CreateSeason.class.getResource("Responsible.fxml"));
			fxmlLoader.setRoot(this);
			fxmlLoader.setController(this);
			fxmlLoader.load();
		} catch (IOException e) {
			// TODO Auto-generated catch block
			e.printStackTrace();
		}
		this.dialog = dialog;
		this.teams.setItems(teams);
		try {
			this.users.setItems(Database.getInstance().getUsers());
			this.userTeamMatches = Database.getInstance().getUserTeamMatching();
		} catch (SQLException e) {
			Platform.runLater(new Runnable() {
				
				@Override
				public void run() {
					
					Action response = Dialogs
							.create()
							.owner(dialog)
							.title("Webservice nicht erreichbar")
							.message("Bitte prüfen Sie ihre Internetverbindung oder versuchen Sie es später noch einmal.")
							.actions(Dialog.Actions.OK)
							.showConfirm();
					dialog.close();
				}
			});
		}
		
		this.responsible.setItems(userTeamMatches);
		this.responsible.setRowFactory(tableview -> {
			final TableRow<Responsible> row = new TableRow<>();
			final ContextMenu contextMenu = new ContextMenu();
			final MenuItem removeMenuItem = new MenuItem("Löschen");
			removeMenuItem.setOnAction(new EventHandler<ActionEvent>() {
				@Override
				public void handle(ActionEvent event) {
					responsible.getItems().remove(row.getItem());
				}
			});
			contextMenu.getItems().add(removeMenuItem);
			// Set context menu on row, but use a binding to make it only show
			// for non-empty rows:
				row.contextMenuProperty().bind(
						Bindings.when(row.emptyProperty())
								.then((ContextMenu) null)
								.otherwise(contextMenu));
				return row;
			});
		this.users.getSelectionModel().select(0);
		this.teams.getSelectionModel().select(0);
		validationSupport.registerValidator(this.users, false, (c, newValue) -> {
			return  ValidationResult.fromErrorIf(users, "Der Benutzer ist diesem Team bereits zugeordnet.", userTeamMatches.size() > 0 && emailTeamCombinationExists());
		});
		validationSupport.registerValidator(this.teams, false, (c, newValue) -> {
			return  ValidationResult.fromErrorIf(ResponsibleView.this.teams, "Der Benutzer ist diesem Team bereits zugeordnet.", userTeamMatches.size() > 0 && emailTeamCombinationExists());
		});
		
		add.disableProperty().bind(validationSupport.invalidProperty());
		this.users.getSelectionModel().selectedItemProperty().addListener( (observable, oldValue, newValue) -> {
			validationSupport.registerValidator(this.users, false, (c, n) -> {
				return  ValidationResult.fromErrorIf(users, "Der Benutzer ist diesem Team bereits zugeordnet.", userTeamMatches.size() > 0 && emailTeamCombinationExists());
			});
			validationSupport.registerValidator(this.teams, false, (c, n) -> {
				return  ValidationResult.fromErrorIf(ResponsibleView.this.teams, "Der Benutzer ist diesem Team bereits zugeordnet.", userTeamMatches.size() > 0 && emailTeamCombinationExists());
			});
		});
		this.teams.getSelectionModel().selectedItemProperty().addListener( (observable, oldValue, newValue) -> {
			validationSupport.registerValidator(this.users, false, (c, n) -> {
				return  ValidationResult.fromErrorIf(users, "Der Benutzer ist diesem Team bereits zugeordnet.", userTeamMatches.size() > 0 && emailTeamCombinationExists());
			});
			validationSupport.registerValidator(this.teams, false, (c, n) -> {
				return  ValidationResult.fromErrorIf(ResponsibleView.this.teams, "Der Benutzer ist diesem Team bereits zugeordnet.", userTeamMatches.size() > 0 && emailTeamCombinationExists());
			});
		});
	}

	private boolean emailTeamCombinationExists() {
		String mail = users.getSelectionModel().getSelectedItem().getEmail();
		String team = teams.getSelectionModel().getSelectedItem().getName();
		for (Responsible responsible : userTeamMatches) {
			if(mail.equals(responsible.getEmail()) && team.equals(responsible.getTeam())){
				return true;
			}
		}
		return false;
	}

	@FXML
	protected void save() {
		try {
			Database.getInstance().setUserTeamMatching(userTeamMatches);
			dialog.close();
		} catch (SQLException e) {
Platform.runLater(new Runnable() {
				
				@Override
				public void run() {
					
					Action response = Dialogs
							.create()
							.owner(dialog)
							.title("Webservice nicht erreichbar")
							.message("Bitte prüfen Sie ihre Internetverbindung oder versuchen Sie es später noch einmal.")
							.actions(Dialog.Actions.OK)
							.showConfirm();
					dialog.close();
				}
			});
		}

	}

	@FXML
	protected void cancel() {
		dialog.close();
	}

	@FXML
	protected void add() {
		userTeamMatches.add(new Responsible(users.getSelectionModel()
				.getSelectedItem().getName(), users.getSelectionModel()
				.getSelectedItem().getEmail(), teams.getSelectionModel()
				.getSelectedItem().getName()));
		users.getSelectionModel().select(0);
		teams.getSelectionModel().select(0);
		validationSupport.registerValidator(this.users, false, (c, newValue) -> {
			return  ValidationResult.fromErrorIf(users, "Der Benutzer ist diesem Team bereits zugeordnet.", userTeamMatches.size() > 0 && emailTeamCombinationExists());
		});
		validationSupport.registerValidator(this.teams, false, (c, newValue) -> {
			return  ValidationResult.fromErrorIf(ResponsibleView.this.teams, "Der Benutzer ist diesem Team bereits zugeordnet.", userTeamMatches.size() > 0 && emailTeamCombinationExists());
		});
	}
}
