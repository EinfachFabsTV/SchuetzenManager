package view;

import java.io.IOException;
import java.util.ArrayList;
import java.util.List;
import java.util.Set;

import javafx.application.Platform;
import javafx.beans.value.ChangeListener;
import javafx.beans.value.ObservableValue;
import javafx.collections.ObservableList;
import javafx.fxml.FXML;
import javafx.fxml.FXMLLoader;
import javafx.scene.control.Button;
import javafx.scene.control.ChoiceBox;
import javafx.scene.control.Control;
import javafx.scene.control.Label;
import javafx.scene.control.ScrollPane;
import javafx.scene.control.TextField;
import javafx.scene.layout.VBox;
import javafx.stage.Stage;
import model.Agegroup;
import model.Match;
import model.Season;
import model.Shoot;

import org.controlsfx.control.textfield.TextFields;
import org.controlsfx.validation.ValidationResult;
import org.controlsfx.validation.ValidationSupport;
import org.controlsfx.validation.Validator;

import database.Database;

public class MatchResult extends ScrollPane {
	private static final String NAMES_EQUAL = "Die Kombination von Vor- und Nachname darf in jedem Team nur einmal vorkommen.";
	@FXML
	private Label hometeam, guestteam;
	@FXML
	private TextField firstname0, firstname1, firstname2, firstname3,
			firstname4, firstname5, firstname6, firstname7;
	@FXML
	private TextField lastname0, lastname1, lastname2, lastname3, lastname4,
			lastname5, lastname6, lastname7;
	@FXML
	private TextField start0, start1, start2, start3, start4, start5, start6,
			start7;
	@FXML
	private ChoiceBox<String> ageclass0, ageclass1, ageclass2, ageclass3,
			ageclass4, ageclass5, ageclass6, ageclass7;

	@FXML
	private TextField end0, end1, end2, end3, end4, end5, end6, end7;
	@FXML
	private TextField score0, score1, score2, score3, score4, score5, score6,
			score7;

	private Match match;
	private Stage dialog;

	@FXML
	private Button save;

	@FXML
	private VBox rows;

	private TextField[] firstnamesHome;
	private TextField[] lastnamesHome;
	private TextField[] startsHome;
	private TextField[] endsHome;
	private TextField[] scoresHome;
	private ChoiceBox[] ageclassHome;

	private TextField[] firstnamesGuest;
	private TextField[] lastnamesGuest;
	private TextField[] startsGuest;
	private TextField[] endsGuest;
	private TextField[] scoresGuest;
	private ChoiceBox[] ageclassGuest;

	private ValidationSupport validation = new ValidationSupport();
	private Validator noValidator = (c, n) -> {
		return ValidationResult.fromErrorIf((Control) c, "", false);
	};

	private List<AdditionalShoot> additionalHomeShoots = new ArrayList<>();
	private List<AdditionalShoot> additionalGuestShoots = new ArrayList<>();
	private Set<String> firstnameValuesHome;
	private Set<String> lastnameValuesHome;
	private Set<String> firstnameValuesGuest;
	private Set<String> lastnameValuesGuest;

	public MatchResult(Match match, Stage dialog) {
		FXMLLoader fxmlLoader = new FXMLLoader(getClass().getResource(
				"MatchResult.fxml"));
		fxmlLoader.setRoot(this);
		fxmlLoader.setController(this);

		firstnameValuesHome = Database.getInstance().getFirstnames(
				match.getHometeam());
		lastnameValuesHome = Database.getInstance().getLastnames(
				match.getHometeam());
		firstnameValuesGuest = Database.getInstance()
				.getFirstnames(match.getGuestteam());
		lastnameValuesGuest = Database.getInstance().getLastnames(
				match.getGuestteam());
		try {
			fxmlLoader.load();
		} catch (IOException e) {
			// TODO Auto-generated catch block
			e.printStackTrace();
		}
		firstname0.getParent().requestFocus();
		hometeam.setText(match.getHometeam());
		guestteam.setText(match.getGuestteam());
		firstnamesHome = new TextField[4];
		lastnamesHome = new TextField[4];
		startsHome = new TextField[4];
		endsHome = new TextField[4];
		scoresHome = new TextField[4];
		ageclassHome = new ChoiceBox[4];
		for (int i = 0; i < 4; i++) {
			try {
				firstnamesHome[i] = (TextField) getClass().getDeclaredField(
						"firstname" + i).get(this);
				TextFields.bindAutoCompletion(firstnamesHome[i],
						firstnameValuesHome);

				lastnamesHome[i] = (TextField) getClass().getDeclaredField(
						"lastname" + i).get(this);
				TextFields.bindAutoCompletion(lastnamesHome[i],
						lastnameValuesHome);
				startsHome[i] = (TextField) getClass().getDeclaredField(
						"start" + i).get(this);
				endsHome[i] = (TextField) getClass()
						.getDeclaredField("end" + i).get(this);
				scoresHome[i] = (TextField) getClass().getDeclaredField(
						"score" + i).get(this);
				ageclassHome[i] = (ChoiceBox) getClass().getDeclaredField(
						"ageclass" + i).get(this);
			} catch (IllegalArgumentException | IllegalAccessException
					| NoSuchFieldException | SecurityException e) {
				// TODO Auto-generated catch block
				e.printStackTrace();
			}
		}

		firstnamesGuest = new TextField[4];
		lastnamesGuest = new TextField[4];
		startsGuest = new TextField[4];
		endsGuest = new TextField[4];
		scoresGuest = new TextField[4];
		ageclassGuest = new ChoiceBox[4];
		for (int i = 0; i < 4; i++) {
			try {
				firstnamesGuest[i] = (TextField) getClass().getDeclaredField(
						"firstname" + (i + 4)).get(this);
				TextFields.bindAutoCompletion(firstnamesGuest[i],
						firstnameValuesGuest);
				lastnamesGuest[i] = (TextField) getClass().getDeclaredField(
						"lastname" + (i + 4)).get(this);
				TextFields.bindAutoCompletion(lastnamesGuest[i],
						lastnameValuesGuest);
				startsGuest[i] = (TextField) getClass().getDeclaredField(
						"start" + (i + 4)).get(this);
				endsGuest[i] = (TextField) getClass().getDeclaredField(
						"end" + (i + 4)).get(this);
				scoresGuest[i] = (TextField) getClass().getDeclaredField(
						"score" + (i + 4)).get(this);
				ageclassGuest[i] = (ChoiceBox) getClass().getDeclaredField(
						"ageclass" + (i + 4)).get(this);
			} catch (IllegalArgumentException | IllegalAccessException
					| NoSuchFieldException | SecurityException e) {
				// TODO Auto-generated catch block
				e.printStackTrace();
			}

		}

		for (int i = 0; i < 4; i++) {
			final int j = i;
			firstnamesGuest[i].textProperty().addListener(getSetAgegroupListener(firstnamesGuest[i], lastnamesGuest[i], ageclassGuest[i], guestteam.getText()));
			lastnamesGuest[i].textProperty().addListener(getSetAgegroupListener(firstnamesGuest[i], lastnamesGuest[i], ageclassGuest[i], guestteam.getText()));
			firstnamesHome[i].textProperty().addListener(getSetAgegroupListener(firstnamesHome[i], lastnamesHome[i], ageclassHome[i], hometeam.getText()));
			lastnamesHome[i].textProperty().addListener(getSetAgegroupListener(firstnamesHome[i], lastnamesHome[i], ageclassHome[i], hometeam.getText()));
			scoresGuest[i].lengthProperty().addListener(
					new ChangeListener<Number>() {

						@Override
						public void changed(
								ObservableValue<? extends Number> observable,
								Number oldValue, Number newValue) {

							if (newValue.intValue() > oldValue.intValue()) {

								try {
									Double.parseDouble(scoresGuest[j].getText()
											.replace(",", "."));
								} catch (NumberFormatException e) {
									scoresGuest[j].setText(scoresGuest[j]
											.getText().substring(
													0,
													scoresGuest[j].getText()
															.length() - 1));
								}

							}
						}

					});
			scoresHome[i].lengthProperty().addListener(
					new ChangeListener<Number>() {

						@Override
						public void changed(
								ObservableValue<? extends Number> observable,
								Number oldValue, Number newValue) {

							if (newValue.intValue() > oldValue.intValue()) {

								try {
									Double.parseDouble(scoresHome[j].getText()
											.replace(",", "."));
								} catch (NumberFormatException e) {
									scoresHome[j].setText(scoresHome[j]
											.getText().substring(
													0,
													scoresHome[j].getText()
															.length() - 1));
								}

							}
						}

					});

			startsGuest[i].lengthProperty().addListener(
					new ChangeListener<Number>() {

						@Override
						public void changed(
								ObservableValue<? extends Number> observable,
								Number oldValue, Number newValue) {
							if (newValue.intValue() > oldValue.intValue()) {

								try {
									Integer.parseInt(startsGuest[j].getText());
								} catch (NumberFormatException e) {
									startsGuest[j].setText(startsGuest[j]
											.getText().substring(
													0,
													startsGuest[j].getText()
															.length() - 1));
								}

							}

						}
					});
			startsHome[i].lengthProperty().addListener(
					new ChangeListener<Number>() {

						@Override
						public void changed(
								ObservableValue<? extends Number> observable,
								Number oldValue, Number newValue) {
							if (newValue.intValue() > oldValue.intValue()) {

								try {
									Integer.parseInt(startsHome[j].getText());
								} catch (NumberFormatException e) {
									startsHome[j].setText(startsHome[j]
											.getText().substring(
													0,
													startsHome[j].getText()
															.length() - 1));
								}

							}

						}
					});
			endsGuest[i].lengthProperty().addListener(
					new ChangeListener<Number>() {

						@Override
						public void changed(
								ObservableValue<? extends Number> observable,
								Number oldValue, Number newValue) {
							if (newValue.intValue() > oldValue.intValue()) {

								try {
									Integer.parseInt(endsGuest[j].getText());
								} catch (NumberFormatException e) {
									endsGuest[j].setText(endsGuest[j].getText()
											.substring(
													0,
													endsGuest[j].getText()
															.length() - 1));
								}

							}

						}
					});
			endsHome[i].lengthProperty().addListener(
					new ChangeListener<Number>() {

						@Override
						public void changed(
								ObservableValue<? extends Number> observable,
								Number oldValue, Number newValue) {
							if (newValue.intValue() > oldValue.intValue()) {

								try {
									Integer.parseInt(endsHome[j].getText());
								} catch (NumberFormatException e) {
									endsHome[j].setText(endsHome[j].getText()
											.substring(
													0,
													endsHome[j].getText()
															.length() - 1));
								}

							}

						}
					});

		}

		ChangeListener<? super String> homeListener = getHomeListener();

		for (int i = 0; i < Math.min(match.getHomeShoots().size(), 4); i++) {
			Shoot shoot = match.getHomeShoots().get(i);
			firstnamesHome[i].setText(shoot.getFirstname());
			firstnamesHome[i].textProperty().addListener(homeListener);
			lastnamesHome[i].setText(shoot.getLastname());
			lastnamesHome[i].textProperty().addListener(homeListener);
			ageclassHome[i].setValue(shoot.getAgegroup());
			startsHome[i].setText(shoot.getStartID() >= 0 ? Integer
					.toString(shoot.getStartID()) : "");
			startsHome[i].textProperty().addListener(homeListener);
			endsHome[i].setText(shoot.getEndID() >= 0 ? Integer.toString(shoot
					.getEndID()) : "");
			endsHome[i].textProperty().addListener(homeListener);
			scoresHome[i].setText(Double.toString(shoot.getScore()));
			scoresHome[i].textProperty().addListener(homeListener);
		}
		ChangeListener<? super String> guestListener = getGuestListener();
		for (int i = 0; i < Math.min(match.getGuestShoots().size(), 4); i++) {

			Shoot shoot = match.getGuestShoots().get(i);
			firstnamesGuest[i].setText(shoot.getFirstname());
			firstnamesGuest[i].textProperty().addListener(guestListener);
			lastnamesGuest[i].setText(shoot.getLastname());
			lastnamesGuest[i].textProperty().addListener(guestListener);
			ageclassGuest[i].setValue(shoot.getAgegroup());
			startsGuest[i].setText(shoot.getStartID() >= 0 ? Integer
					.toString(shoot.getStartID()) : "");
			startsGuest[i].textProperty().addListener(guestListener);
			endsGuest[i].setText(shoot.getEndID() >= 0 ? Integer.toString(shoot
					.getEndID()) : "");
			endsGuest[i].textProperty().addListener(guestListener);
			scoresGuest[i].setText(Double.toString(shoot.getScore()));
			scoresGuest[i].textProperty().addListener(guestListener);
		}

		this.match = match;
		this.dialog = dialog;
		validation.invalidProperty().addListener(
				(observable, oldValue, newValue) -> {
					save.setDisable(newValue);
				});

		for (int i = 0; i < match.getAddHomeShoots().size(); i++) {
			Shoot sh = match.getAddHomeShoots().get(i);
			AdditionalShoot adhs = new AdditionalShoot(sh.getFirstname(),
					sh.getLastname(), sh.getAgegroup(), sh.getStartID(),
					sh.getEndID(), sh.getScore());
			rows.getChildren().add(8 + i, adhs);
			additionalHomeShoots.add(adhs);
		}
		for (int i = 0; i < match.getAddGuestShoots().size(); i++) {
			Shoot sh = match.getAddGuestShoots().get(i);
			AdditionalShoot adhs = new AdditionalShoot(sh.getFirstname(),
					sh.getLastname(), sh.getAgegroup(), sh.getStartID(),
					sh.getEndID(), sh.getScore());
			rows.getChildren().add(18 + i + additionalHomeShoots.size(), adhs);
			additionalGuestShoots.add(adhs);
		}

		for (AdditionalShoot shoot : additionalGuestShoots) {
			setAdditionalShootListener(shoot, getGuestListener(), firstnameValuesGuest, lastnameValuesGuest);
		}

		for (AdditionalShoot shoot : additionalHomeShoots) {
			setAdditionalShootListener(shoot, getHomeListener(), firstnameValuesHome, lastnameValuesHome);
		}
		rows.setPrefHeight((rows.getChildren().size()) * 30 - 40);
	}

	private ChangeListener<? super String> getHomeListener() {
		return (observable, oldValue, newValue) -> {
			for (int j = 0; j < 4; j++) {
				final int i = j;
				validation
						.registerValidator(
								firstnamesHome[i],
								false,
								(c, n) -> {
									if (homeRowNeedsValidation(i)
											&& firstnamesHome[i].getText()
													.trim().length() == 0) {
										return ValidationResult
												.fromErrorIf(
														(Control) c,
														"Der Vorname muss angegeben werden.",
														true);
									}
									return ValidationResult
											.fromErrorIf(
													(Control) c,
													NAMES_EQUAL,
													countNames(
															firstnamesHome[i]
																	.getText(),
															lastnamesHome[i]
																	.getText(),
															true) > 1);
								});
				validation
						.registerValidator(
								lastnamesHome[i],
								false,
								(c, n) -> {
									if (homeRowNeedsValidation(i)
											&& lastnamesHome[i].getText()
													.trim().length() == 0) {
										return ValidationResult
												.fromError((Control) c,
														"Der Nachname muss angegeben werden.");
									}
									return ValidationResult
											.fromErrorIf(
													(Control) c,
													NAMES_EQUAL,
													countNames(
															firstnamesHome[i]
																	.getText(),
															lastnamesHome[i]
																	.getText(),
															true) > 1);
								});
				validation
						.registerValidator(
								startsHome[i],
								false,
								(c, n) -> {
									return ValidationResult
											.fromErrorIf(
													(Control) c,
													"Wenn eine Endnummer angegeben wird, muss auch eine Startnummer angegeben werden.",
													startsHome[i].getText()
															.trim().length() == 0
															&& endsHome[i]
																	.getText()
																	.trim()
																	.length() > 0);
								});
				validation
						.registerValidator(
								endsHome[i],
								false,
								(c, n) -> {
									return ValidationResult
											.fromErrorIf(
													(Control) c,
													"Wenn eine Startnummer angegeben wird, muss auch eine Endnummer angegeben werden.",
													endsHome[i].getText()
															.trim().length() == 0
															&& startsHome[i]
																	.getText()
																	.trim()
																	.length() > 0);
								});
				validation.registerValidator(scoresHome[i], false, (c, n) -> {
					return ValidationResult
							.fromErrorIf((Control) c,
									"Die Ringe müssen angegeben werden",
									homeRowNeedsValidation(i)
											&& scoresHome[i].getText().trim()
													.length() == 0);
				});
			}
			for (AdditionalShoot additionalShoot : additionalHomeShoots) {
				validation
						.registerValidator(
								additionalShoot.firstname,
								false,
								(c, n) -> {
									if (additionalShootNeedsValidation(additionalShoot)
											&& additionalShoot.getFirstname()
													.trim().length() == 0) {
										return ValidationResult
												.fromErrorIf(
														(Control) c,
														"Der Vorname muss angegeben werden.",
														true);
									}
									return ValidationResult.fromErrorIf(
											(Control) c,
											NAMES_EQUAL,
											countNames(additionalShoot
													.getFirstname(),
													additionalShoot
															.getLastname(),
													true) > 1);
								});
				validation
						.registerValidator(
								additionalShoot.lastname,
								false,
								(c, n) -> {
									if (additionalShootNeedsValidation(additionalShoot)
											&& additionalShoot.getLastname()
													.trim().length() == 0) {
										return ValidationResult
												.fromError((Control) c,
														"Der Nachname muss angegeben werden.");
									}
									return ValidationResult.fromErrorIf(
											(Control) c,
											NAMES_EQUAL,
											countNames(additionalShoot
													.getFirstname(),
													additionalShoot
															.getLastname(),
													true) > 1);
								});
				validation
						.registerValidator(
								additionalShoot.start,
								false,
								(c, n) -> {
									return ValidationResult
											.fromErrorIf(
													(Control) c,
													"Wenn eine Endnummer angegeben wird, muss auch eine Startnummer angegeben werden.",
													additionalShoot.getStart()
															.trim().length() == 0
															&& additionalShoot
																	.getEnd()
																	.trim()
																	.length() > 0);
								});
				validation
						.registerValidator(
								additionalShoot.end,
								false,
								(c, n) -> {
									return ValidationResult
											.fromErrorIf(
													(Control) c,
													"Wenn eine Startnummer angegeben wird, muss auch eine Endnummer angegeben werden.",
													additionalShoot.getEnd()
															.trim().length() == 0
															&& additionalShoot
																	.getStart()
																	.trim()
																	.length() > 0);
								});
				validation.registerValidator(additionalShoot.score, false, (c,
						n) -> {
					return ValidationResult.fromErrorIf((Control) c,
							"Die Ringe müssen angegeben werden",
							additionalShootNeedsValidation(additionalShoot)
									&& additionalShoot.getScore().trim()
											.length() == 0);
				});
			}

		};
	}

	private boolean homeRowNeedsValidation(int i) {
		double score = 0;
		try {
			score = Double.parseDouble(scoresHome[i].getText());
		} catch (NumberFormatException e) {
		}
		return firstnamesHome[i].getText().trim().length() > 0
				|| lastnamesHome[i].getText().trim().length() > 0
				|| startsHome[i].getText().trim().length() > 0
				|| endsHome[i].getText().trim().length() > 0 || score > 0;
	}

	private boolean additionalShootNeedsValidation(
			AdditionalShoot additionalShoot) {
		double score = 0;
		try {
			score = Double.parseDouble(additionalShoot.getScore());
		} catch (NumberFormatException e) {
		}
		return additionalShoot.getFirstname().trim().length() > 0
				|| additionalShoot.getLastname().trim().length() > 0
				|| additionalShoot.getStart().trim().length() > 0
				|| additionalShoot.getEnd().trim().length() > 0 || score > 0;
	}

	private ChangeListener<? super String> getSetAgegroupListener(TextField firstname, TextField lastname, ChoiceBox agegroupBox, String team){
		return (observable, oldValue, newValue) ->{
			Agegroup agegroup = Database.getInstance().getAgeGroup(firstname.getText(), lastname.getText(), team);
			System.out.println(agegroup);
			if(agegroup != null){
				agegroupBox.getSelectionModel().select(agegroup.toString());
			}
		};
	}
	
	private ChangeListener<? super String> getGuestListener() {
		return (observable, oldValue, newValue) -> {
			for (int j = 0; j < 4; j++) {
				final int i = j;
				validation
						.registerValidator(
								firstnamesGuest[i],
								false,
								(c, n) -> {
									if (guestRowNeedsValidation(i)
											&& firstnamesGuest[i].getText()
													.trim().length() == 0) {
										return ValidationResult
												.fromErrorIf(
														(Control) c,
														"Der Vorname muss angegeben werden.",
														true);
									}
									return ValidationResult
											.fromErrorIf(
													(Control) c,
													NAMES_EQUAL,
													countNames(
															firstnamesGuest[i]
																	.getText(),
															lastnamesGuest[i]
																	.getText(),
															true) > 1);
								});
				validation
						.registerValidator(
								lastnamesGuest[i],
								false,
								(c, n) -> {
									if (guestRowNeedsValidation(i)
											&& lastnamesGuest[i].getText()
													.trim().length() == 0) {
										return ValidationResult
												.fromError((Control) c,
														"Der Nachname muss angegeben werden.");
									}
									return ValidationResult
											.fromErrorIf(
													(Control) c,
													NAMES_EQUAL,
													countNames(
															firstnamesGuest[i]
																	.getText(),
															lastnamesGuest[i]
																	.getText(),
															true) > 1);
								});
				validation
						.registerValidator(
								startsGuest[i],
								false,
								(c, n) -> {
									return ValidationResult
											.fromErrorIf(
													(Control) c,
													"Wenn eine Endnummer angegeben wird, muss auch eine Startnummer angegeben werden.",
													startsGuest[i].getText()
															.trim().length() == 0
															&& endsGuest[i]
																	.getText()
																	.trim()
																	.length() > 0);
								});
				validation
						.registerValidator(
								endsGuest[i],
								false,
								(c, n) -> {
									return ValidationResult
											.fromErrorIf(
													(Control) c,
													"Wenn eine Startnummer angegeben wird, muss auch eine Endnummer angegeben werden.",
													endsGuest[i].getText()
															.trim().length() == 0
															&& startsGuest[i]
																	.getText()
																	.trim()
																	.length() > 0);
								});
				validation.registerValidator(scoresGuest[i], false, (c, n) -> {
					return ValidationResult
							.fromErrorIf((Control) c,
									"Die Ringe müssen angegeben werden",
									guestRowNeedsValidation(i)
											&& scoresGuest[i].getText().trim()
													.length() == 0);
				});
			}
			for (AdditionalShoot additionalShoot : additionalGuestShoots) {
				validation.registerValidator(additionalShoot.firstname, false,
						(c, n) -> {
							if (additionalShootNeedsValidation(additionalShoot)
									&& additionalShoot.getFirstname().trim()
											.length() == 0) {
								return ValidationResult.fromErrorIf(
										(Control) c,
										"Der Vorname muss angegeben werden.",
										true);
							}
							return ValidationResult.fromErrorIf(
									(Control) c,
									NAMES_EQUAL,
									countNames(additionalShoot.getFirstname(),
											additionalShoot.getLastname(),
											false) > 1);
						});
				validation.registerValidator(additionalShoot.lastname, false,
						(c, n) -> {
							if (additionalShootNeedsValidation(additionalShoot)
									&& additionalShoot.getLastname().trim()
											.length() == 0) {
								return ValidationResult.fromError((Control) c,
										"Der Nachname muss angegeben werden.");
							}
							return ValidationResult.fromErrorIf(
									(Control) c,
									NAMES_EQUAL,
									countNames(additionalShoot.getFirstname(),
											additionalShoot.getLastname(),
											false) > 1);
						});
				validation
						.registerValidator(
								additionalShoot.start,
								false,
								(c, n) -> {
									return ValidationResult
											.fromErrorIf(
													(Control) c,
													"Wenn eine Endnummer angegeben wird, muss auch eine Startnummer angegeben werden.",
													additionalShoot.getStart()
															.trim().length() == 0
															&& additionalShoot
																	.getEnd()
																	.trim()
																	.length() > 0);
								});
				validation
						.registerValidator(
								additionalShoot.end,
								false,
								(c, n) -> {
									return ValidationResult
											.fromErrorIf(
													(Control) c,
													"Wenn eine Startnummer angegeben wird, muss auch eine Endnummer angegeben werden.",
													additionalShoot.getEnd()
															.trim().length() == 0
															&& additionalShoot
																	.getStart()
																	.trim()
																	.length() > 0);
								});
				validation.registerValidator(additionalShoot.score, false, (c,
						n) -> {
					return ValidationResult.fromErrorIf((Control) c,
							"Die Ringe müssen angegeben werden",
							additionalShootNeedsValidation(additionalShoot)
									&& additionalShoot.getScore().trim()
											.length() == 0);
				});
			}

		};
	}

	private int countNames(String fname, String lname, boolean home) {

		String firstname = fname.trim();
		String lastname = lname.trim();
		if (firstname.length() == 0 && lastname.length() == 0) {
			return 0;
		}
		TextField[] firstnames = home ? firstnamesHome : firstnamesGuest;
		TextField[] lastnames = home ? lastnamesHome : lastnamesGuest;
		int count = 0;
		for (int i = 0; i < 4; i++) {
			if (firstname.equals(firstnames[i].getText().trim())
					&& lastname.equals(lastnames[i].getText().trim())) {
				count++;
			}
		}
		List<AdditionalShoot> additional = home ? additionalHomeShoots
				: additionalGuestShoots;
		for (AdditionalShoot additionalShoot : additional) {
			if (firstname.equals(additionalShoot.getFirstname().trim())
					&& lastname.equals(additionalShoot.getLastname().trim())) {
				count++;
			}
		}
		return count;
	}

	private boolean guestRowNeedsValidation(int i) {
		double score = 0;
		try {
			score = Double.parseDouble(scoresGuest[i].getText());
		} catch (NumberFormatException e) {
		}
		return firstnamesGuest[i].getText().trim().length() > 0
				|| lastnamesGuest[i].getText().trim().length() > 0
				|| startsGuest[i].getText().trim().length() > 0
				|| endsGuest[i].getText().trim().length() > 0 || score > 0;
	}

	@FXML
	protected void save() {
		System.out.println(save);

		for (int i = 0; i < 4; i++) {

			int start = -1;
			int end = -1;
			try {
				start = Integer.parseInt(startsGuest[i].getText());
				end = Integer.parseInt(endsGuest[i].getText());
			} catch (NumberFormatException e) {

			}
			Shoot guestShoot = match.getGuestShoots().get(i);
			guestShoot.setFirstname(firstnamesGuest[i].getText().trim());
			guestShoot.setLastname(lastnamesGuest[i].getText().trim());
			guestShoot.setStartID(start);
			guestShoot.setEndID(end);
			guestShoot.setAgegroup((String) ageclassGuest[i].getValue());
			double score = 0;
			try {
				score = Double.parseDouble(scoresGuest[i].getText().replace(
						",", "."));
			} catch (NumberFormatException e1) {
				// Nothing to do. If empty and there is another entry user cant
				// click save.
			}
			guestShoot.setScore(score);

			start = -1;
			end = -1;
			try {
				start = Integer.parseInt(startsHome[i].getText());
				end = Integer.parseInt(endsHome[i].getText());
			} catch (NumberFormatException e) {

			}
			Shoot homeshoot = match.getHomeShoots().get(i);

			homeshoot.setFirstname(firstnamesHome[i].getText().trim());
			homeshoot.setLastname(lastnamesHome[i].getText().trim());
			homeshoot.setStartID(start);
			homeshoot.setEndID(end);
			homeshoot.setAgegroup((String) ageclassHome[i].getValue());
			score = 0;
			try {
				score = Double.parseDouble(scoresHome[i].getText().replace(",",
						"."));
			} catch (NumberFormatException e) {
				// Nothing to do. If empty and there is another entry user cant
				// click save.
			}
			homeshoot.setScore(score);
		}
		match.getAddHomeShoots().clear();
		Season season = Database.getInstance().getSeason();
		for (AdditionalShoot additionalShoot : additionalHomeShoots) {
			if (additionalShoot.getFirstname().trim().length() > 0) {
				Shoot homeshoot = season.getNewAditionalShoot(match, true);
				int start = -1;
				int end = -1;
				try {
					start = Integer.parseInt(additionalShoot.getStart());
					end = Integer.parseInt(additionalShoot.getEnd());
				} catch (NumberFormatException e) {

				}
				homeshoot.setFirstname(additionalShoot.getFirstname());
				homeshoot.setLastname(additionalShoot.getLastname());
				homeshoot.setStartID(start);
				homeshoot.setEndID(end);
				homeshoot.setAgegroup(additionalShoot.getAgeclass());
				double score = 0;
				try {
					score = Double.parseDouble(additionalShoot.getScore()
							.replace(",", "."));
				} catch (NumberFormatException e) {
					// Nothing to do. If empty and there is another entry user
					// cant
					// click save.
				}
				homeshoot.setScore(score);
				match.getAddHomeShoots().add(homeshoot);
			}
		}
		match.getAddGuestShoots().clear();
		for (AdditionalShoot additionalShoot : additionalGuestShoots) {
			if (additionalShoot.getFirstname().trim().length() > 0) {
				Shoot guestshoot = season.getNewAditionalShoot(match, false);
				int start = -1;
				int end = -1;
				try {
					start = Integer.parseInt(additionalShoot.getStart());
					end = Integer.parseInt(additionalShoot.getEnd());
				} catch (NumberFormatException e) {

				}
				guestshoot.setFirstname(additionalShoot.getFirstname());
				guestshoot.setLastname(additionalShoot.getLastname());
				guestshoot.setStartID(start);
				guestshoot.setEndID(end);
				guestshoot.setAgegroup(additionalShoot.getAgeclass());
				double score = 0;
				try {
					score = Double.parseDouble(additionalShoot.getScore()
							.replace(",", "."));
				} catch (NumberFormatException e) {
					// Nothing to do. If empty and there is another entry user
					// cant
					// click save.
				}
				guestshoot.setScore(score);
				match.getAddGuestShoots().add(guestshoot);
			}
		}
		Database.getInstance().updateMatch(match);
		Platform.runLater(new Runnable() {
			
			@Override
			public void run() {
				Database.getInstance().refresh();
			}
		});
		Season seasod = Database.getInstance().getSeason();
		System.out.println("");
		dialog.close();
	}

	@FXML
	protected void cancel() {
		dialog.close();
	}

	@FXML
	protected void addAdditionalHome() {
		AdditionalShoot shoot = new AdditionalShoot("", "", "Schützenklasse",
				-1, -1, 0);
		setAdditionalShootListener(shoot, getHomeListener(), firstnameValuesHome, lastnameValuesHome);
		rows.getChildren().add(8 + +additionalHomeShoots.size(), shoot);
		additionalHomeShoots.add(shoot);
		rows.setPrefHeight((rows.getChildren().size()) * 30 - 40);

	}
	
	private void setAdditionalShootListener(AdditionalShoot shoot, ChangeListener<? super String> listener, Set<String> firstnames, Set<String> lastnames){
		TextFields.bindAutoCompletion(shoot.firstname, firstnames);
		TextFields.bindAutoCompletion(shoot.lastname, lastnames);
		shoot.firstname.textProperty().addListener(listener);
		shoot.lastname.textProperty().addListener(listener);
		shoot.start.textProperty().addListener(listener);
		shoot.end.textProperty().addListener(listener);
		shoot.score.textProperty().addListener(listener);
		shoot.score.lengthProperty().addListener(
				new ChangeListener<Number>() {

					@Override
					public void changed(
							ObservableValue<? extends Number> observable,
							Number oldValue, Number newValue) {

						if (newValue.intValue() > oldValue.intValue()) {

							try {
								Double.parseDouble(shoot.score.getText()
										.replace(",", "."));
							} catch (NumberFormatException e) {
								shoot.score.setText(shoot.score.getText()
										.substring(
												0,
												shoot.score.getText()
														.length() - 1));
							}

						}
					}

				});

		shoot.start.lengthProperty().addListener(
				new ChangeListener<Number>() {

					@Override
					public void changed(
							ObservableValue<? extends Number> observable,
							Number oldValue, Number newValue) {
						if (newValue.intValue() > oldValue.intValue()) {

							try {
								Integer.parseInt(shoot.start.getText());
							} catch (NumberFormatException e) {
								shoot.start.setText(shoot.start.getText()
										.substring(
												0,
												shoot.start.getText()
														.length() - 1));
							}

						}

					}
				});

		shoot.end.lengthProperty().addListener(
				new ChangeListener<Number>() {

					@Override
					public void changed(
							ObservableValue<? extends Number> observable,
							Number oldValue, Number newValue) {
						if (newValue.intValue() > oldValue.intValue()) {

							try {
								Integer.parseInt(shoot.end.getText());
							} catch (NumberFormatException e) {
								shoot.end.setText(shoot.end.getText()
										.substring(
												0,
												shoot.end.getText()
														.length() - 1));
							}

						}

					}
				});

	}

	@FXML
	protected void addAdditionalGuest() {

		AdditionalShoot adgs = new AdditionalShoot("", "", "Schützenklasse",
				-1, -1, 0);
		setAdditionalShootListener(adgs, getGuestListener(), firstnameValuesGuest, lastnameValuesGuest);
		rows.getChildren()
				.add(18 + additionalGuestShoots.size()
						+ additionalHomeShoots.size(), adgs);
		additionalGuestShoots.add(adgs);
		rows.setPrefHeight((rows.getChildren().size()) * 30 - 40);

	}
}
