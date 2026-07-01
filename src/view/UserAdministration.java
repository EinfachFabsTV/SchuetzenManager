package view;

import java.io.IOException;
import java.math.BigInteger;
import java.security.SecureRandom;
import java.sql.SQLException;
import java.util.HashMap;
import java.util.Map;

import org.apache.commons.validator.EmailValidator;
import org.controlsfx.validation.ValidationResult;
import org.controlsfx.validation.ValidationSupport;
import org.controlsfx.validation.Validator;

import database.Database;
import javafx.application.Platform;
import javafx.beans.binding.Bindings;
import javafx.beans.value.ChangeListener;
import javafx.collections.FXCollections;
import javafx.collections.ObservableList;
import javafx.event.ActionEvent;
import javafx.event.EventHandler;
import javafx.fxml.FXML;
import javafx.fxml.FXMLLoader;
import javafx.scene.control.Button;
import javafx.scene.control.ContextMenu;
import javafx.scene.control.Label;
import javafx.scene.control.MenuItem;
import javafx.scene.control.ProgressIndicator;
import javafx.scene.control.TableRow;
import javafx.scene.control.TableView;
import javafx.scene.control.TextField;
import javafx.scene.layout.GridPane;
import javafx.stage.Stage;
import model.User;
import tools.SendMail;

public class UserAdministration extends GridPane {

	@FXML
	private TableView<User> usertable;

	@FXML
	private Button add, save, cancel;

	@FXML
	private Label info;

	@FXML
	private ProgressIndicator progress;

	@FXML
	private TextField name, email;

	private Map<User, String> needNotification;
	private ObservableList<User> users;

	private Stage dialog;
	private ValidationSupport validationSupport = new ValidationSupport();

	public UserAdministration(Stage dialog) {
		try {
			FXMLLoader fxmlLoader = new FXMLLoader(
					CreateSeason.class.getResource("UserAdministration.fxml"));
			fxmlLoader.setRoot(this);
			fxmlLoader.setController(this);
			fxmlLoader.load();
		} catch (IOException e) {
			// TODO Auto-generated catch block
			e.printStackTrace();
		}
		validationSupport.registerValidator(name, false, Validator
				.createEmptyValidator("Es muss ein Name angegeben werden."));
		validationSupport
				.registerValidator(
						email,
						false,
						(c, newValue) -> {
							if (email.getText().trim().length() == 0) {
								return ValidationResult.fromError(email,
										"Es muss eine E-Mail angegeben werden");
							} else {

								return ValidationResult
										.fromErrorIf(
												email,
												"Die Eingabe entspricht nicht der Form einer E-Mail.",
												!EmailValidator
														.getInstance()
														.isValid(
																email.getText()));
							}
						});
		ChangeListener<Boolean> focusListener = (observable, oldValue, newValue) -> {
			if (email.focusedProperty().get() || name.focusedProperty().get()
					|| email.getText().trim().length() > 0
					|| name.getText().trim().length() > 0) {
				validationSupport
						.registerValidator(
								name,
								false,
								Validator
										.createEmptyValidator("Es muss ein Name angegeben werden."));
				validationSupport
						.registerValidator(
								email,
								false,
								(c, n) -> {
									if (email.getText().trim().length() == 0) {
										return ValidationResult
												.fromError(email,
														"Es muss eine E-Mail angegeben werden");
									} else if (!EmailValidator.getInstance()
											.isValid(email.getText())) {
										return ValidationResult
												.fromError(email,
														"Die Eingabe entspricht nicht der Form einer E-Mail.");
									} else
										return ValidationResult
												.fromErrorIf(
														email,
														"E-Mail-Adresse bereits vorhanden.",
														mailExists());
								});
			} else {
				validationSupport.registerValidator(name, false, (c, n) -> {
					return ValidationResult.fromErrorIf(name, "", false);
				});
				validationSupport.registerValidator(email, false, (c, n) -> {
					return ValidationResult.fromErrorIf(email, "", false);
				});
				add.setDisable(true);
			}
		};
		name.focusedProperty().addListener(focusListener);
		email.focusedProperty().addListener(focusListener);
		validationSupport.invalidProperty().addListener(
				(observable, oldValue, newValue) -> {
					add.setDisable(newValue
							|| name.getText().trim().length() == 0
							|| email.getText().trim().length() == 0);
				});
		;
		this.dialog = dialog;
		users = FXCollections.observableArrayList();
		try {
			users = Database.getInstance().getUsers();
		} catch (SQLException e) {
			e.printStackTrace();
			Platform.runLater(new Runnable() {

				@Override
				public void run() {

//					Action response = Dialogs
//							.create()
//							.owner(dialog)
//							.title("Webservice nicht erreichbar")
//							.message("Bitte prüfen Sie ihre Internetverbindung oder versuchen Sie es später noch einmal.")
//							.actions(Dialog.Actions.OK)
//							.showConfirm();
//					dialog.close();
				}
			});
		}
		needNotification = new HashMap<>();
		usertable.setItems(users);
		usertable
				.setRowFactory(tableview -> {
					final TableRow<User> row = new TableRow<>();
					final ContextMenu contextMenu = new ContextMenu();
					final MenuItem removeMenuItem = new MenuItem("Löschen");
					removeMenuItem.setOnAction(new EventHandler<ActionEvent>() {
						@Override
						public void handle(ActionEvent event) {
							usertable.getItems().remove(row.getItem());
						}
					});
					contextMenu.getItems().add(removeMenuItem);
					final MenuItem resetMenuItem = new MenuItem(
							"Passwort zurücksetzen");
					resetMenuItem.setOnAction(new EventHandler<ActionEvent>() {
						@Override
						public void handle(ActionEvent event) {
							SecureRandom random = new SecureRandom();
							String password = new BigInteger(64, random)
									.toString(16);
							row.getItem().setPassword(password);
							UserAdministration.this.needNotification.put(
									row.getItem(), password);
							usertable.getColumns().get(0).setVisible(false);
							usertable.getColumns().get(0).setVisible(true);
						}
					});
					contextMenu.getItems().add(resetMenuItem);
					// Set context menu on row, but use a binding to make it
					// only show
					// for non-empty rows:
				row.contextMenuProperty().bind(
						Bindings.when(row.emptyProperty())
								.then((ContextMenu) null)
								.otherwise(contextMenu));
				return row;
			});

	}

	private boolean mailExists() {
		for (User user : users) {
			if (email.getText().trim().equals(user.getEmail())) {
				return true;
			}
		}
		return false;
	}

	@FXML
	protected void save() {
		save.setDisable(true);
		cancel.setDisable(true);
		info.setVisible(true);
		info.setText("");
		progress.setVisible(true);
		progress.setProgress(-1);
		boolean success = false;
		try {
			success = Database.getInstance().setUsers(users);
		} catch (SQLException e) {
			e.printStackTrace();
			Platform.runLater(new Runnable() {

				@Override
				public void run() {

//					Action response = Dialogs
//							.create()
//							.owner(dialog)
//							.title("Webservice nicht erreichbar")
//							.message("Bitte prüfen Sie ihre Internetverbindung oder versuchen Sie es später noch einmal.")
//							.actions(Dialog.Actions.OK)
//							.showConfirm();
//					dialog.close();
				}
			});
		}
		if (success) {
			new Thread(new Runnable() {

				@Override
				public void run() {
					for (User user : needNotification.keySet()) {
						String password = needNotification.get(user);
						String text = "Hallo "
								+ user.getName()
								+ ", \n"
								+ "dein neues Passwort / neuer Account zum Eintragen der Ergebnisse des Rundenwettkampfs vom Schützenkreis Meppen sind folgende: \n"
								+ "\nWebseite Rundenwettkampf: http://chkater.de/Rundenwettkampf/ \n"
								+ "\nE-Mail: " + user.getEmail() + "\n"
								+ "Passwort: " + password + "\n\n\n"
								+ "Mit freundlichen Grüßen"
								+ "Schützenkreis Meppen";
						SendMail.sendMail(
								user.getEmail(),
								"Neues Passwort Rundenwettkämpfe Schützenkreis Meppen",
								text);
					}
					needNotification.clear();
				}
			}).start();
			dialog.close();
		} else {
			info.setText("Es konnte keine Verbindung zum Webdienst aufgebaut werden.");
			save.setDisable(false);
			cancel.setDisable(false);
		}
	}

	@FXML
	protected void cancel() {
		dialog.close();
	}

	@FXML
	protected void add() {
		SecureRandom random = new SecureRandom();
		String password = new BigInteger(64, random).toString(16);
		User user = new User(email.getText().trim(), name.getText().trim(),
				password);
		users.add(user);
		needNotification.put(user, password);
		name.setText("");
		email.setText("");

	}
}
